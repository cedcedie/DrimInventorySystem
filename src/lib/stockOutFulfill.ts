import type { Prisma } from "@/generated/prisma";
import { nextRefNo } from "@/lib/refNo";

type Tx = Prisma.TransactionClient;

export type FulfillLineResult = {
  refNo: string;
  mrfId: string;
  mrfRefNo: string;
  project: string;
  technicianId: string;
  productName: string;
  qty: number;
  /** Set when this fulfillment dropped the product from above minLevel to at
   * or below it (or to 0) — caller fires the low-stock notification outside
   * the transaction so a notification failure never rolls back a real
   * stock-out. Undefined when no threshold was crossed. */
  lowStockCrossed?: { productId: string; productName: string; stocks: number; minLevel: number };
};

/** Fulfills one MRF line inside an open transaction. Caller owns retry/isolation. */
export async function fulfillMrfItemInTx(
  tx: Tx,
  opts: { mrfItemId: string; quantity: number; byUserId: string }
): Promise<FulfillLineResult> {
  const { mrfItemId, quantity, byUserId } = opts;

  const mrfItem = await tx.mrfItem.findUnique({
    where: { id: mrfItemId },
    include: {
      product: true,
      mrf: {
        include: {
          technician: { select: { id: true, name: true, userId: true } },
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
  // Re-read stocks for concurrent safety within the transaction
  const freshProduct = await tx.product.findUnique({ where: { id: product.id } });
  if (!freshProduct) throw new Error("Product not found");
  if (quantity > freshProduct.stocks) {
    throw new Error(`Only ${freshProduct.stocks} available in stock for ${freshProduct.name}`);
  }

  const refNo = await nextRefNo(tx, "stockOut", "SO");

  await tx.stockOut.create({
    data: {
      refNo,
      productId: product.id,
      mrfItemId: mrfItem.id,
      mrfId: mrfItem.mrfId,
      technicianId: mrfItem.mrf.technicianId,
      qty: quantity,
      byUserId,
    },
  });

  const stocksAfter = freshProduct.stocks - quantity;
  await tx.product.update({
    where: { id: product.id },
    data: { stocks: { decrement: quantity } },
  });
  const crossedThreshold = freshProduct.stocks > freshProduct.minLevel && stocksAfter <= freshProduct.minLevel;

  await tx.mrfItem.update({
    where: { id: mrfItem.id },
    data: { qtyFulfilled: { increment: quantity } },
  });

  const allMrfItems = await tx.mrfItem.findMany({
    where: { mrfId: mrfItem.mrfId },
    select: { qtyRequested: true, qtyFulfilled: true },
  });

  const allFullyFulfilled = allMrfItems.every((item) => item.qtyFulfilled >= item.qtyRequested);
  const anyReleased = allMrfItems.some((item) => item.qtyFulfilled > 0);
  const newMrfStatus = allFullyFulfilled ? "FULFILLED" : anyReleased ? "PARTIAL" : "PENDING";

  await tx.mrf.updateMany({
    where: {
      id: mrfItem.mrfId,
      status: { in: ["PENDING", "PARTIAL"] },
    },
    data: { status: newMrfStatus },
  });

  await tx.activityLog.create({
    data: {
      userId: byUserId,
      action: `Released Stock Out — ${quantity} × ${product.name} — ${mrfItem.mrf.project} (${mrfItem.mrf.refNo})`,
      refNo,
    },
  });

  return {
    refNo,
    mrfId: mrfItem.mrfId,
    mrfRefNo: mrfItem.mrf.refNo,
    project: mrfItem.mrf.project,
    technicianId: mrfItem.mrf.technicianId,
    productName: product.name,
    qty: quantity,
    lowStockCrossed: crossedThreshold
      ? { productId: product.id, productName: product.name, stocks: stocksAfter, minLevel: freshProduct.minLevel }
      : undefined,
  };
}

export async function resolveMrfStatusAfterFulfill(
  tx: Tx,
  mrfId: string
): Promise<"PENDING" | "PARTIAL" | "FULFILLED" | "CANCELLED"> {
  const mrf = await tx.mrf.findUnique({
    where: { id: mrfId },
    select: {
      status: true,
      items: { select: { qtyRequested: true, qtyFulfilled: true } },
    },
  });
  if (!mrf) return "PENDING";
  if (mrf.status === "CANCELLED") return "CANCELLED";
  const allFully = mrf.items.every((i) => i.qtyFulfilled >= i.qtyRequested);
  if (allFully) return "FULFILLED";
  if (mrf.items.some((i) => i.qtyFulfilled > 0)) return "PARTIAL";
  return "PENDING";
}
