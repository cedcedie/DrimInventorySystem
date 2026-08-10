import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { notifyTechMrfUpdate } from "@/lib/notifications";
import { withRefNoRetry } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { fulfillMrfItemInTx } from "@/lib/stockOutFulfill";
import { parseBody } from "@/lib/validate";
import { stockOutBulkSchema } from "@/lib/schemas";

/** Fulfill multiple open lines on one MRF in a single transaction. */
export async function POST(req: Request) {
  const auth = await requireModuleAccess("stock", "canCreate");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, stockOutBulkSchema);
  if ("error" in parsed) return parsed.error;
  const { mrfId, items } = parsed.data;

  const uniqueIds = new Set(items.map((i) => i.mrfItemId));
  if (uniqueIds.size !== items.length) {
    return NextResponse.json({ error: "Duplicate MRF line items in request" }, { status: 400 });
  }

  try {
    const results = await withRefNoRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const mrf = await tx.mrf.findUnique({
            where: { id: mrfId },
            select: {
              id: true,
              refNo: true,
              project: true,
              status: true,
              technicianId: true,
              items: { select: { id: true } },
            },
          });
          if (!mrf) throw new Error("MRF not found");
          if (mrf.status === "CANCELLED") throw new Error("This MRF has been cancelled");
          if (mrf.status === "FULFILLED") throw new Error("This MRF is already fully fulfilled");

          const allowed = new Set(mrf.items.map((i) => i.id));
          for (const line of items) {
            if (!allowed.has(line.mrfItemId)) {
              throw new Error("One or more lines do not belong to this MRF");
            }
          }

          const fulfilled = [];
          for (const line of items) {
            fulfilled.push(
              await fulfillMrfItemInTx(tx, {
                mrfItemId: line.mrfItemId,
                quantity: line.qty,
                byUserId: auth.session.user.id,
              })
            );
          }
          return { mrf, fulfilled };
        },
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 }
      )
    );

    const tech = await prisma.technician.findUnique({
      where: { id: results.mrf.technicianId },
      select: { userId: true },
    });
    const totalQty = results.fulfilled.reduce((s, r) => s + r.qty, 0);
    await notifyTechMrfUpdate({
      technicianUserId: tech?.userId,
      type: "mrf_fulfilled",
      mrfRefNo: results.mrf.refNo,
      body: `Warehouse released ${results.fulfilled.length} line(s) (${totalQty} qty) for ${results.mrf.project}`,
    });

    revalidateAfterMutation(["inventory", "products", "stock-out", "mrf"]);
    return NextResponse.json(
      {
        mrfRefNo: results.mrf.refNo,
        refNos: results.fulfilled.map((r) => r.refNo),
        count: results.fulfilled.length,
      },
      { status: 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bulk Stock Out failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
