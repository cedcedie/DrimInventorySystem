import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { getProductsData } from "@/lib/data/products";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { productCreateSchema } from "@/lib/schemas";
import { uniqueConstraintResponse } from "@/lib/apiError";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("products");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getProductsData({
    page: Number(searchParams.get("page") ?? "1"),
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });

  // Unit cost is Owner/Admin-only — never let it leave the server for other roles,
  // regardless of what the UI chooses to render.
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json({
      ...data,
      rows: data.rows.map((row) => {
        const { amount, ...rest } = row;
        void amount;
        return rest;
      }),
    });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("products", "canCreate");
  if ("error" in auth) return auth.error;

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
    const conflict = uniqueConstraintResponse(e, "Product code already exists");
    if (conflict) return conflict;
    throw e;
  }
}
