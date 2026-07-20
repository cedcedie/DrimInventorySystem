import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { getProductsData } from "@/lib/data/products";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { productCreateSchema } from "@/lib/schemas";

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

  const parsed = await parseBody(req, productCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { code, name, categoryId, unit, amount, stocks, minLevel, supplierId, imageKey } = parsed.data;

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          code,
          name,
          categoryId,
          unit,
          amount: amount ?? 0,
          stocks: stocks ?? 0,
          minLevel: minLevel ?? 0,
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
