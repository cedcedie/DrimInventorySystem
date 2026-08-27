import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getPurchaseOrderDetail } from "@/lib/data/purchaseOrders";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { isSerializationConflictError } from "@/lib/refNo";
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
    const updated = await prisma.$transaction(
      async (tx) => {
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

        // Guard the write with the status just read, not a blind update-by-id —
        // a Stock In against this PO can move it to PARTIALLY_RECEIVED between
        // the read above and this write; without the guard this would silently
        // overwrite that status back to what was decided from stale data.
        const result = await tx.purchaseOrder.updateMany({
          where: { id, status: po.status },
          data: { status },
        });
        if (result.count === 0) {
          throw new Error("Purchase Order status changed concurrently — please retry");
        }

        await tx.activityLog.create({
          data: {
            userId: auth.session.user.id,
            action: `Purchase Order ${po.refNo} — ${status === "CANCELLED" ? "cancelled" : "marked sent"}`,
            refNo: po.refNo,
          },
        });

        return { id: po.id, status };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
    );

    revalidateAfterMutation(["purchase-orders"]);
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (e) {
    // Genuine simultaneous contention on the same PO aborts the updateMany
    // itself with a raw Serializable write-conflict — verified live with 5
    // concurrent cancel requests (exactly 1 succeeds, the rest land here).
    // Same real-world meaning as the "changed concurrently" guard above, so
    // give it the same friendly message instead of leaking the Prisma error.
    if (isSerializationConflictError(e)) {
      return NextResponse.json(
        { error: "Purchase Order status changed concurrently — please retry" },
        { status: 409 }
      );
    }
    const message = e instanceof Error ? e.message : "Could not update Purchase Order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
