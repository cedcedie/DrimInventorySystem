import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { notifyTechMrfUpdate, notifyLowStock } from "@/lib/notifications";
import { nextRefNo, withSerializableRetry } from "@/lib/refNo";
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
    // Ref numbers come from the atomic RefCounter, outside this transaction —
    // see the comment in src/app/api/mrf/route.ts for why they must not be
    // generated inside a Serializable-isolation transaction. One per line,
    // allocated sequentially up front (each call is its own atomic increment,
    // so this can't collide with another request's allocation either).
    const refNos = await Promise.all(items.map(() => nextRefNo(prisma, "SO")));

    const results = await withSerializableRetry(() =>
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
          for (let i = 0; i < items.length; i++) {
            const line = items[i];
            fulfilled.push(
              await fulfillMrfItemInTx(tx, {
                mrfItemId: line.mrfItemId,
                quantity: line.qty,
                byUserId: auth.session.user.id,
                refNo: refNos[i],
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
    const crossedByProduct = new Map(
      results.fulfilled.filter((r) => r.lowStockCrossed).map((r) => [r.lowStockCrossed!.productId, r.lowStockCrossed!])
    );
    for (const crossed of crossedByProduct.values()) {
      await notifyLowStock({ ...crossed, excludeUserId: auth.session.user.id });
    }

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
