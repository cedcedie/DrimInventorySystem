import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { isProductRequestable } from "@/lib/mrfLifecycle";
import { prisma } from "@/lib/prisma";
import { nextRefNo, withSerializableRetry } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { purchaseRequestDecideSchema } from "@/lib/schemas";
import { notifyRequesterPrDecided } from "@/lib/notifications";

/** Approve or reject a PENDING Purchase Request. Approval creates the PurchaseOrder in the
 * same transaction as the status change, so a request is never left APPROVED without a
 * linked PO. Owner/Admin only — deciding is separate authority from raising a request. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("purchaseRequests");
  if ("error" in auth) return auth.error;
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json(
      { error: "Deciding a Purchase Request requires Owner or Admin" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const parsed = await parseBody(req, purchaseRequestDecideSchema);
  if ("error" in parsed) return parsed.error;
  const decision = parsed.data;

  try {
    // Ref number comes from the atomic RefCounter, outside this transaction —
    // see the comment in src/app/api/mrf/route.ts for why it must not run
    // inside a Serializable-isolation transaction. Allocated up front for the
    // approve path even though the PR's PENDING status is only authoritatively
    // confirmed once inside the transaction below — if someone else decided
    // this PR in the meantime, the transaction throws and this PO number is
    // simply never used (a gap in the sequence, not a collision — fine, same
    // as any other rolled-back transaction that already claimed a number).
    // Serializable isolation stays on the transaction itself, wrapped in a
    // retry: it's still protecting a real race (two Owners deciding the same
    // PR at once), just not a ref-number one anymore, and a P2034 write
    // conflict is retried while a genuine "already decided" business error
    // is not (see withSerializableRetry's retry condition).
    const poRefNo = decision.decision === "approve" ? await nextRefNo(prisma, "PO") : undefined;

    const result = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const pr = await tx.purchaseRequest.findUnique({
            where: { id },
            include: { items: true },
          });
          if (!pr) throw new Error("Purchase Request not found");
          if (pr.status !== "PENDING") {
            throw new Error("This request has already been decided");
          }

          if (decision.decision === "reject") {
            const updated = await tx.purchaseRequest.update({
              where: { id },
              data: {
                status: "REJECTED",
                decidedById: auth.session.user.id,
                decidedAt: new Date(),
                decisionNote: decision.note,
              },
            });
            await tx.activityLog.create({
              data: {
                userId: auth.session.user.id,
                action: `Purchase Request ${pr.refNo} — rejected: ${decision.note}`,
                refNo: pr.refNo,
              },
            });
            return { pr: updated, po: null as { id: string; refNo: string } | null };
          }

          // Needs a supplier either already on the PR or supplied now.
          const supplierId = decision.supplierId ?? pr.supplierId;
          if (!supplierId) {
            throw new Error("A supplier is required to approve this request");
          }
          const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
          if (!supplier) throw new Error("Supplier not found");

          // A product referenced on this PR may have been archived after the
          // request was filed but before it's decided — re-check at approval
          // time, same guard the direct PO-create route already applies.
          const productIds = pr.items.map((item) => item.productId);
          const products = await tx.product.findMany({ where: { id: { in: productIds } } });
          if (products.length !== productIds.length) {
            throw new Error("One or more requested products no longer exist");
          }
          const notRequestable = products.find((p) => !isProductRequestable(p.archivedAt));
          if (notRequestable) {
            throw new Error(`${notRequestable.name} is archived and can't be ordered`);
          }

          if (!poRefNo) throw new Error("Missing ref number for approval — please retry");
          const po = await tx.purchaseOrder.create({
            data: {
              refNo: poRefNo,
              supplierId,
              status: "SENT",
              notes: pr.notes,
              byUserId: auth.session.user.id,
              items: {
                create: pr.items.map((item) => ({
                  productId: item.productId,
                  qtyOrdered: item.qtyRequested,
                })),
              },
            },
          });

          const updated = await tx.purchaseRequest.update({
            where: { id },
            data: {
              status: "APPROVED",
              supplierId,
              decidedById: auth.session.user.id,
              decidedAt: new Date(),
              decisionNote: decision.note || null,
              purchaseOrderId: po.id,
            },
          });

          const totalQty = pr.items.reduce((sum, item) => sum + item.qtyRequested, 0);
          await tx.activityLog.create({
            data: {
              userId: auth.session.user.id,
              action: `Purchase Request ${pr.refNo} — approved, converted to ${poRefNo} (${pr.items.length} item(s), ${totalQty} total qty, from ${supplier.name})`,
              refNo: poRefNo,
            },
          });

          return { pr: updated, po: { id: po.id, refNo: po.refNo } };
        },
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
      )
    );

    revalidateAfterMutation(["purchase-requests", "purchase-orders"]);

    await notifyRequesterPrDecided({
      requesterUserId: result.pr.byUserId,
      decision: decision.decision === "approve" ? "approved" : "rejected",
      prRefNo: result.pr.refNo,
      poRefNo: result.po?.refNo,
      reason: decision.decision === "reject" ? decision.note : undefined,
    });

    return NextResponse.json({
      id: result.pr.id,
      status: result.pr.status,
      purchaseOrder: result.po,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not decide Purchase Request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
