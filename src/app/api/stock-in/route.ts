import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockInData } from "@/lib/data/stock";
import { prisma } from "@/lib/prisma";
import { nextRefNo } from "@/lib/refNo";
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
  const { productId, supplierId, qty: quantity } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error("Product not found");

        const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) throw new Error("Supplier not found");

        const refNo = await nextRefNo(tx, "stockIn", "SI");

        const stockIn = await tx.stockIn.create({
          data: { refNo, productId, supplierId, qty: quantity, byUserId: auth.session.user.id },
        });

        await tx.product.update({
          where: { id: productId },
          data: { stocks: { increment: quantity } },
        });

        await tx.activityLog.create({
          data: {
            userId: auth.session.user.id,
            action: `Recorded Stock In — ${quantity} × ${product.name}`,
            refNo,
          },
        });

        return stockIn;
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
    );

    revalidateAfterMutation(["inventory", "products", "stock-in"]);
    return NextResponse.json({ refNo: result.refNo }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stock In failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
