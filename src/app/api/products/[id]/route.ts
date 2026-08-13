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

/** Soft-archive the product. History (SI/SO/MRF/ADJ) is preserved; product is
 * hidden from active catalog and stock options. Hard delete only when unused. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("products", "canDelete");
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (product.archivedAt) {
    return NextResponse.json({ error: "Product is already archived" }, { status: 409 });
  }

  // Archiving blocks new MRF requests and new Stock In receipts for this product
  // (see isProductRequestable / stock-in validation) — if an MRF still has an open
  // line for it, archiving now would leave that request permanently unfulfillable
  // with no way for warehouse to restock it. Surface the open MRFs so whoever's
  // archiving can close/redirect them first instead of hitting a silent dead end.
  const openItems = await prisma.mrfItem.findMany({
    where: {
      productId: id,
      mrf: { status: { in: ["PENDING", "PARTIAL"] } },
    },
    select: {
      qtyRequested: true,
      qtyFulfilled: true,
      mrf: { select: { refNo: true } },
    },
  });
  const openRefNos = [
    ...new Set(
      openItems.filter((item) => item.qtyFulfilled < item.qtyRequested).map((item) => item.mrf.refNo)
    ),
  ];
  if (openRefNos.length > 0) {
    return NextResponse.json(
      {
        error: `Can't archive — ${openRefNos.length} open request(s) still reference this product (${openRefNos.join(", ")}). Fulfill or close them first.`,
      },
      { status: 409 }
    );
  }

  const [siCount, soCount, mrfCount, adjCount] = await Promise.all([
    prisma.stockIn.count({ where: { productId: id } }),
    prisma.stockOut.count({ where: { productId: id } }),
    prisma.mrfItem.count({ where: { productId: id } }),
    prisma.stockAdjustment.count({ where: { productId: id } }),
  ]);
  const hasHistory = siCount + soCount + mrfCount + adjCount > 0;

  await prisma.$transaction(async (tx) => {
    if (hasHistory) {
      await tx.product.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Archived product ${product.name} (history retained)`,
          refNo: product.code,
        },
      });
    } else {
      await tx.product.delete({ where: { id } });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Removed product ${product.name} from catalog`,
          refNo: product.code,
        },
      });
    }
  });

  revalidateAfterMutation(["products", "inventory"]);
  return NextResponse.json({ ok: true, archived: hasHistory });
}
