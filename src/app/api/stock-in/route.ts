import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockInData } from "@/lib/data/stock";
import { isProductRequestable } from "@/lib/mrfLifecycle";
import { prisma } from "@/lib/prisma";
import { nextRefNo, withRefNoRetry } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { stockInSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getStockInData({ page: Number(searchParams.get("page") ?? "1") });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("stock", "canCreate");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, stockInSchema);
  if ("error" in parsed) return parsed.error;
  const { supplierId, items, purchaseOrderId } = parsed.data;

  try {
    const result = await withRefNoRetry(() =>
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
            for (const item of items) {
              const poItem = po.items.find((i) => i.productId === item.productId);
              if (!poItem) continue;
              const remaining = poItem.qtyOrdered - poItem.qtyReceived;
              const applied = Math.min(remaining, item.qty);
              if (applied > 0) {
                await tx.purchaseOrderItem.update({
                  where: { id: poItem.id },
                  data: { qtyReceived: { increment: applied } },
                });
              }
            }

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

          const refNo = await nextRefNo(tx, "stockInBatch", "SI");

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

          for (const item of items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stocks: { increment: item.qty } },
            });
          }

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
