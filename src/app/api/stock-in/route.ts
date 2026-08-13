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
  const { supplierId, items } = parsed.data;

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

          const refNo = await nextRefNo(tx, "stockInBatch", "SI");

          const batch = await tx.stockInBatch.create({
            data: {
              refNo,
              supplierId,
              byUserId: auth.session.user.id,
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
              action: `Recorded Stock In — ${itemsSummary}`,
              refNo,
            },
          });

          return batch;
        },
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
      )
    );

    revalidateAfterMutation(["inventory", "products", "stock-in"]);
    return NextResponse.json({ refNo: result.refNo }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stock In failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
