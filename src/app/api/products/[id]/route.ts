import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("products");
  if ("error" in auth) return auth.error;
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json({ error: "Only Owner or Admin can edit products" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { code, name, categoryId, unit, amount, stocks, minLevel, supplierId, imageKey } = body;

  if (!code || !name || !categoryId || !unit) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
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
          action: `Edited product ${updated.name}`,
          refNo: updated.code,
        },
      });
      return updated;
    });

    revalidateAfterMutation(["products", "inventory"]);
    return NextResponse.json({ id: product.id });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Product code already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("products");
  if ("error" in auth) return auth.error;
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json({ error: "Only Owner or Admin can delete products" }, { status: 403 });
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.delete({ where: { id } });
    await tx.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: `Removed product ${product.name} from catalog`,
        refNo: product.code,
      },
    });
  });

  revalidateAfterMutation(["products", "inventory"]);
  return NextResponse.json({ ok: true });
}
