import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getPurchaseRequestDetail } from "@/lib/data/purchaseRequests";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("purchaseRequests");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const pr = await getPurchaseRequestDetail(id);
  if (!pr) {
    return NextResponse.json({ error: "Purchase Request not found" }, { status: 404 });
  }

  return NextResponse.json(pr);
}

/** Withdraw a still-PENDING request — requester themself, or Owner/Admin on anyone's behalf. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("purchaseRequests", "canCreate");
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.findUnique({ where: { id } });
      if (!pr) throw new Error("Purchase Request not found");
      if (pr.status !== "PENDING") {
        throw new Error("Only a pending request can be cancelled");
      }
      const isOwnerOrAdmin = auth.role === "OWNER" || auth.role === "ADMIN";
      if (pr.byUserId !== auth.session.user.id && !isOwnerOrAdmin) {
        throw new Error("You can only cancel your own requests");
      }

      const result = await tx.purchaseRequest.update({ where: { id }, data: { status: "CANCELLED" } });

      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Purchase Request ${pr.refNo} — cancelled`,
          refNo: pr.refNo,
        },
      });

      return result;
    });

    revalidateAfterMutation(["purchase-requests"]);
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not cancel Purchase Request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
