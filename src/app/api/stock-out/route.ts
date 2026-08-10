import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockOutData } from "@/lib/data/stock";
import { prisma } from "@/lib/prisma";
import { nextRefNo, withRefNoRetry } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { stockOutSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getStockOutData({ page: Number(searchParams.get("page") ?? "1") });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("stock", "canCreate");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, stockOutSchema);
  if ("error" in parsed) return parsed.error;
  const { mrfItemId, qty: quantity } = parsed.data;

  try {
    const result = await withRefNoRetry(() =>
      prisma.$transaction(
        async (tx) => {
          // Fetch MRF item with related data
          const mrfItem = await tx.mrfItem.findUnique({
            where: { id: mrfItemId },
            include: {
              product: true,
              mrf: {
                include: {
                  technician: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          });

          if (!mrfItem) throw new Error("MRF item not found");
          if (mrfItem.mrf.status === "CANCELLED") throw new Error("This MRF has been cancelled");

          const remainingQty = mrfItem.qtyRequested - mrfItem.qtyFulfilled;
          if (remainingQty <= 0) throw new Error("This item has already been fully fulfilled");
          if (quantity > remainingQty) {
            throw new Error(`Only ${remainingQty} remaining to fulfill for this item`);
          }

          const product = mrfItem.product;
          if (quantity > product.stocks) {
            throw new Error(`Only ${product.stocks} available in stock`);
          }

          const refNo = await nextRefNo(tx, "stockOut", "SO");

          // Create stock out record
          const stockOut = await tx.stockOut.create({
            data: {
              refNo,
              productId: product.id,
              mrfItemId: mrfItem.id,
              mrfId: mrfItem.mrfId,
              technicianId: mrfItem.mrf.technicianId,
              qty: quantity,
              byUserId: auth.session.user.id,
            },
          });

          // Decrement product stock
          await tx.product.update({
            where: { id: product.id },
            data: { stocks: { decrement: quantity } },
          });

          // Update MRF item fulfilled quantity
          await tx.mrfItem.update({
            where: { id: mrfItem.id },
            data: {
              qtyFulfilled: {
                increment: quantity,
              },
            },
          });

          // Check if all items in the MRF are fully fulfilled
          const allMrfItems = await tx.mrfItem.findMany({
            where: { mrfId: mrfItem.mrfId },
            select: {
              qtyRequested: true,
              qtyFulfilled: true,
            },
          });

          const allFullyFulfilled = allMrfItems.every(
            (item) => item.qtyFulfilled >= item.qtyRequested
          );
          const anyPartiallyFulfilled = allMrfItems.some(
            (item) => item.qtyFulfilled > 0 && item.qtyFulfilled < item.qtyRequested
          );

          // Update MRF status
          const newMrfStatus = allFullyFulfilled
            ? "FULFILLED"
            : anyPartiallyFulfilled || allMrfItems.some((item) => item.qtyFulfilled > 0)
              ? "PARTIAL"
              : "PENDING";

          await tx.mrf.updateMany({
            where: {
              id: mrfItem.mrfId,
              status: { in: ["PENDING", "PARTIAL"] },
            },
            data: { status: newMrfStatus },
          });

          // Create activity log
          await tx.activityLog.create({
            data: {
              userId: auth.session.user.id,
              action: `Released Stock Out — ${quantity} × ${product.name} — ${mrfItem.mrf.project} (${mrfItem.mrf.refNo})`,
              refNo,
            },
          });

          return stockOut;
        },
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
      )
    );

    revalidateAfterMutation(["inventory", "products", "stock-out", "mrf"]);
    return NextResponse.json({ refNo: result.refNo }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stock Out failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
