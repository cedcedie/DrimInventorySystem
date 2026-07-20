import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockOutData } from "@/lib/data/stock";
import { prisma } from "@/lib/prisma";
import { nextRefNo } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { stockOutSchema } from "@/lib/schemas";
import type { Role } from "@prisma/client";

function canRecordStock(role: Role): boolean {
  return role === "ADMIN" || role === "WAREHOUSE_STAFF" || role === "OWNER";
}

export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getStockOutData({ page: Number(searchParams.get("page") ?? "1") });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;
  if (!canRecordStock(auth.role)) {
    return NextResponse.json({ error: "Stock Out requires Admin or Warehouse Staff role" }, { status: 403 });
  }

  const parsed = await parseBody(req, stockOutSchema);
  if ("error" in parsed) return parsed.error;
  const { mrfId, qty: quantity } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const mrf = await tx.mrf.findUnique({
          where: { id: mrfId },
          include: { product: true, technician: true },
        });
        if (!mrf) throw new Error("MRF not found");
        if (mrf.status !== "PENDING") throw new Error("This MRF has already been fulfilled or cancelled");

        const product = await tx.product.findUnique({ where: { id: mrf.productId } });
        if (!product) throw new Error("Product not found");
        if (quantity > product.stocks) {
          throw new Error(`Only ${product.stocks} available`);
        }

        const refNo = await nextRefNo(tx, "stockOut", "SO");

        const stockOut = await tx.stockOut.create({
          data: {
            refNo,
            productId: product.id,
            mrfId: mrf.id,
            technicianId: mrf.technicianId,
            qty: quantity,
            byUserId: auth.session.user.id,
          },
        });

        await tx.product.update({
          where: { id: product.id },
          data: { stocks: { decrement: quantity } },
        });

        await tx.mrf.update({
          where: { id: mrf.id },
          data: { status: "FULFILLED" },
        });

        await tx.activityLog.create({
          data: {
            userId: auth.session.user.id,
            action: `Released Stock Out — ${quantity} × ${product.name} — ${mrf.project}`,
            refNo,
          },
        });

        return stockOut;
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
    );

    revalidateAfterMutation(["inventory", "products", "stock-out", "mrf"]);
    return NextResponse.json({ refNo: result.refNo }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stock Out failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
