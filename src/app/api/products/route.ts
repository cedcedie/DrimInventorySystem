import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { getProductsData } from "@/lib/data/products";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("products");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getProductsData({ page: Number(searchParams.get("page") ?? "1") });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("products");
  if ("error" in auth) return auth.error;
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json({ error: "Only Owner or Admin can add products" }, { status: 403 });
  }

  const body = await req.json();
  const { code, name, categoryId, unit, amount, stocks, minLevel, supplierId, imageKey } = body;

  if (!code || !name || !categoryId || !unit) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          code,
          name,
          categoryId,
          unit,
          amount: Number(amount) || 0,
          stocks: Number(stocks) || 0,
          minLevel: Number(minLevel) || 0,
          supplierId: supplierId || null,
          imageKey: imageKey || null,
        },
      });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Added product ${created.name} to catalog`,
          refNo: created.code,
        },
      });
      return created;
    });

    revalidateAfterMutation(["products", "inventory"]);
    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Product code already exists" }, { status: 409 });
    }
    throw e;
  }
}
