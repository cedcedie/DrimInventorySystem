import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { productUpdateSchema } from "@/lib/schemas";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("products", "canEdit");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = await parseBody(req, productUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { code, name, categoryId, unit, amount, minLevel, supplierId, imageKey } = parsed.data;

  try {
    const product = await prisma.$transaction(async (tx) => {
      // `stocks` is intentionally not written here — see productUpdateSchema.
      // Count changes go through Stock In/Out or POST /api/stock-adjustments.
      const updated = await tx.product.update({
        where: { id },
        data: {
          code,
          name,
          categoryId,
          unit,
          amount: amount ?? 0,
          minLevel: minLevel ?? 0,
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
  const auth = await requireModuleAccess("products", "canDelete");
  if ("error" in auth) return auth.error;

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
