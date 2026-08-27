import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getPurchaseOrdersData } from "@/lib/data/purchaseOrders";
import { isProductRequestable } from "@/lib/mrfLifecycle";
import { prisma } from "@/lib/prisma";
import { nextRefNo } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { purchaseOrderCreateSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("purchaseOrders");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getPurchaseOrdersData({
    page: Number(searchParams.get("page") ?? "1"),
    refNo: searchParams.get("refNo") ?? undefined,
    supplier: searchParams.get("supplier") ?? undefined,
    item: searchParams.get("item") ?? undefined,
    filedBy: searchParams.get("filedBy") ?? undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("purchaseOrders", "canCreate");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, purchaseOrderCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { supplierId, items, notes } = parsed.data;

  try {
    // Ref number comes from the atomic RefCounter, outside this transaction —
    // see the comment in src/app/api/mrf/route.ts for why it must not run
    // inside a Serializable-isolation transaction. Nothing else here is a
    // shared, contested resource (every row created is new), so the rest of
    // the transaction doesn't need Serializable either.
    const refNo = await nextRefNo(prisma, "PO");
    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) throw new Error("Supplier not found");

      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      if (products.length !== productIds.length) {
        throw new Error("One or more products not found");
      }
      const notRequestable = products.find((p) => !isProductRequestable(p.archivedAt));
      if (notRequestable) {
        throw new Error(`${notRequestable.name} is archived and can't be ordered`);
      }

      const po = await tx.purchaseOrder.create({
        data: {
          refNo,
          supplierId,
          status: "SENT",
          notes: notes || null,
          byUserId: auth.session.user.id,
          items: {
            create: items.map((item) => ({ productId: item.productId, qtyOrdered: item.qty })),
          },
        },
      });

      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Created Purchase Order — ${items.length} item(s), ${totalQty} total qty, from ${supplier.name}`,
          refNo,
        },
      });

      return po;
    });

    revalidateAfterMutation(["purchase-orders"]);
    return NextResponse.json({ id: result.id, refNo: result.refNo }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Purchase Order creation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
