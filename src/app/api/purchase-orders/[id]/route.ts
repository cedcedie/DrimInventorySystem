import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getPurchaseOrderDetail } from "@/lib/data/purchaseOrders";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { purchaseOrderStatusSchema } from "@/lib/schemas";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("purchaseOrders");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const po = await getPurchaseOrderDetail(id);
  if (!po) {
    return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
  }

  return NextResponse.json(po);
}

/** Manual status transitions only — SENT→CANCELLED. Receiving happens
 * implicitly through Stock In batches linked to this PO (see stock-in
 * route), which move qtyReceived and derive PARTIALLY_RECEIVED/RECEIVED. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("purchaseOrders", "canEdit");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = await parseBody(req, purchaseOrderStatusSchema);
  if ("error" in parsed) return parsed.error;
  const { status } = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: { select: { qtyReceived: true } } },
      });
      if (!po) throw new Error("Purchase Order not found");
      if (po.status === "CANCELLED") throw new Error("This Purchase Order is already cancelled");
      if (po.status === "RECEIVED") throw new Error("A fully received Purchase Order can't be changed");

      if (status === "CANCELLED") {
        const anyReceived = po.items.some((i) => i.qtyReceived > 0);
        if (anyReceived) {
          throw new Error(
            "This PO already has partial deliveries — cancelling would hide what's still expected. Leave it open instead."
          );
        }
      }

      const result = await tx.purchaseOrder.update({ where: { id }, data: { status } });

      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Purchase Order ${po.refNo} — ${status === "CANCELLED" ? "cancelled" : "marked sent"}`,
          refNo: po.refNo,
        },
      });

      return result;
    });

    revalidateAfterMutation(["purchase-orders"]);
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update Purchase Order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
