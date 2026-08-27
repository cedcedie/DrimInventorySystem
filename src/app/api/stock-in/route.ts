import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockInData } from "@/lib/data/stock";
import { isProductRequestable } from "@/lib/mrfLifecycle";
import { prisma } from "@/lib/prisma";
import { nextRefNo, withSerializableRetry } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { stockInSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getStockInData({
    page: Number(searchParams.get("page") ?? "1"),
    q: searchParams.get("q") ?? undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("stock", "canCreate");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, stockInSchema);
  if ("error" in parsed) return parsed.error;
  const { supplierId, items, purchaseOrderId } = parsed.data;

  try {
    // Ref number comes from the atomic RefCounter, outside this transaction —
    // see the comment in src/app/api/mrf/route.ts for why it must not run
    // inside a Serializable-isolation transaction. Serializable stays on the
    // transaction itself, wrapped in a retry: it's protecting the real races
    // (PO qtyReceived, product.stocks), just not a ref-number one anymore.
    const refNo = await nextRefNo(prisma, "SI");

    const result = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
          if (!supplier) throw new Error("Supplier not found");

          const productIds = items.map((item) => item.productId);
          const products = await tx.product.findMany({ where: { id: { in: productIds } } });
          if (products.length !== productIds.length) {
            throw new Error("One or more products not found");
          }
          const notRequestable = products.find((p) => !isProductRequestable(p.archivedAt));
          if (notRequestable) {
            throw new Error(`${notRequestable.name} is archived and can't receive stock`);
          }
          const productsById = new Map(products.map((p) => [p.id, p]));

          let poRefNo: string | undefined;
          if (purchaseOrderId) {
            const po = await tx.purchaseOrder.findUnique({
              where: { id: purchaseOrderId },
              include: { items: true },
            });
            if (!po) throw new Error("Linked Purchase Order not found");
            if (po.supplierId !== supplierId) {
              throw new Error("Linked Purchase Order is for a different supplier");
            }
            if (po.status === "CANCELLED" || po.status === "RECEIVED") {
              throw new Error(`This Purchase Order is already ${po.status.toLowerCase()}`);
            }
            poRefNo = po.refNo;

            // Cap applied qty at what was ordered; extra delivered qty still updates stock below.
            // Collapsed by productId first (same reasoning as the stock-increment
            // loop below — two concurrent updates to the same row from inside
            // one transaction risks a self-deadlock, not just wasted round-trips),
            // then run concurrently since each remaining update is a distinct row.
            const deliveredQtyByProduct = new Map<string, number>();
            for (const item of items) {
              deliveredQtyByProduct.set(
                item.productId,
                (deliveredQtyByProduct.get(item.productId) ?? 0) + item.qty
              );
            }
            await Promise.all(
              Array.from(deliveredQtyByProduct.entries()).map(([productId, deliveredQty]) => {
                const poItem = po.items.find((i) => i.productId === productId);
                if (!poItem) return null;
                const remaining = poItem.qtyOrdered - poItem.qtyReceived;
                const applied = Math.min(remaining, deliveredQty);
                if (applied <= 0) return null;
                return tx.purchaseOrderItem.update({
                  where: { id: poItem.id },
                  data: { qtyReceived: { increment: applied } },
                });
              })
            );

            const refreshedItems = await tx.purchaseOrderItem.findMany({
              where: { purchaseOrderId },
              select: { qtyOrdered: true, qtyReceived: true },
            });
            const allReceived = refreshedItems.every((i) => i.qtyReceived >= i.qtyOrdered);
            const anyReceived = refreshedItems.some((i) => i.qtyReceived > 0);
            await tx.purchaseOrder.update({
              where: { id: purchaseOrderId },
              data: { status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status },
            });
          }

          const batch = await tx.stockInBatch.create({
            data: {
              refNo,
              supplierId,
              byUserId: auth.session.user.id,
              purchaseOrderId: purchaseOrderId ?? null,
              items: {
                create: items.map((item) => ({ productId: item.productId, qty: item.qty })),
              },
            },
            include: { items: true },
          });

          // Collapse duplicate productIds first — the schema allows the same
          // product twice in one submission, and firing two concurrent
          // `increment` updates at the same row from inside one transaction
          // is a self-deadlock risk, not just a wasted round-trip. Once
          // collapsed, each remaining update targets a distinct row, so
          // running them concurrently instead of one-at-a-time is safe.
          const qtyByProduct = new Map<string, number>();
          for (const item of items) {
            qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
          }
          await Promise.all(
            Array.from(qtyByProduct.entries()).map(([productId, qty]) =>
              tx.product.update({
                where: { id: productId },
                data: { stocks: { increment: qty } },
              })
            )
          );

          const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
          const itemsSummary =
            items.length === 1
              ? `${totalQty} × ${productsById.get(items[0].productId)?.name ?? "1 item"}`
              : `${items.length} items (${totalQty} total qty)`;

          await tx.activityLog.create({
            data: {
              userId: auth.session.user.id,
              action: `Recorded Stock In — ${itemsSummary}${poRefNo ? ` (against ${poRefNo})` : ""}`,
              refNo,
            },
          });

          return batch;
        },
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
      )
    );

    revalidateAfterMutation(purchaseOrderId ? ["inventory", "products", "stock-in", "purchase-orders"] : ["inventory", "products", "stock-in"]);
    return NextResponse.json({ refNo: result.refNo }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stock In failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
