import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getPurchaseRequestsData } from "@/lib/data/purchaseRequests";
import { isProductRequestable } from "@/lib/mrfLifecycle";
import { prisma } from "@/lib/prisma";
import { nextRefNo } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { purchaseRequestCreateSchema } from "@/lib/schemas";
import { notifyOwnersPrFiled } from "@/lib/notifications";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("purchaseRequests");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getPurchaseRequestsData({
    page: Number(searchParams.get("page") ?? "1"),
    refNo: searchParams.get("refNo") ?? undefined,
    supplier: searchParams.get("supplier") ?? undefined,
    item: searchParams.get("item") ?? undefined,
    filedBy: searchParams.get("filedBy") ?? undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("purchaseRequests", "canCreate");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, purchaseRequestCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { supplierId, items, notes } = parsed.data;

  try {
    // Ref number comes from the atomic RefCounter, outside this transaction —
    // see the comment in src/app/api/mrf/route.ts for why it must not run
    // inside a Serializable-isolation transaction. Nothing else here is a
    // shared, contested resource, so the rest doesn't need Serializable either.
    const refNo = await nextRefNo(prisma, "PR");
    const result = await prisma.$transaction(async (tx) => {
      if (supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) throw new Error("Supplier not found");
      }

      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      if (products.length !== productIds.length) {
        throw new Error("One or more products not found");
      }
      const notRequestable = products.find((p) => !isProductRequestable(p.archivedAt));
      if (notRequestable) {
        throw new Error(`${notRequestable.name} is archived and can't be requested`);
      }

      const pr = await tx.purchaseRequest.create({
        data: {
          refNo,
          supplierId: supplierId ?? null,
          notes: notes || null,
          byUserId: auth.session.user.id,
          items: {
            create: items.map((item) => ({ productId: item.productId, qtyRequested: item.qty })),
          },
        },
      });

      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Filed Purchase Request — ${items.length} item(s), ${totalQty} total qty`,
          refNo,
        },
      });

      return { pr, products, totalQty };
    });

    revalidateAfterMutation(["purchase-requests"]);

    await notifyOwnersPrFiled({
      prRefNo: result.pr.refNo,
      itemSummary:
        items.length === 1
          ? `${result.totalQty} × ${result.products[0]?.name ?? "item"}`
          : `${items.length} items`,
      requesterName: auth.session.user.name ?? auth.session.user.username ?? "Someone",
      excludeUserId: auth.session.user.id,
    });

    return NextResponse.json({ id: result.pr.id, refNo: result.pr.refNo }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Purchase Request creation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
