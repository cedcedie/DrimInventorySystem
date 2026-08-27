import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { isProductRequestable } from "@/lib/mrfLifecycle";
import { notifyLowStock } from "@/lib/notifications";
import { nextRefNo, withSerializableRetry } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { stockAdjustmentSchema } from "@/lib/schemas";
import { getStockAdjustmentsData } from "@/lib/data/adjustments";

const REASON_LABELS: Record<string, string> = {
  MISCOUNT: "Miscount",
  DAMAGED: "Damaged",
  LOST: "Lost",
  FOUND: "Found",
  RETURN: "Returned unused",
  CORRECTION: "Data correction",
};

export async function GET(req: Request) {
  const auth = await requireModuleAccess("inventory");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getStockAdjustmentsData({
    page: Number(searchParams.get("page") ?? "1"),
    q: searchParams.get("q") ?? undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("inventory", "canEdit");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, stockAdjustmentSchema);
  if ("error" in parsed) return parsed.error;
  const { productId, qtyAfter, reason, note } = parsed.data;

  try {
    // Ref number comes from the atomic RefCounter, outside this transaction —
    // see the comment in src/app/api/mrf/route.ts for why it must not run
    // inside a Serializable-isolation transaction. If the transaction below
    // turns out to have nothing to adjust, this number is simply never used
    // (a gap, not a collision). Serializable stays on the transaction itself:
    // it's protecting the real race on `product.stocks` (read-then-correct),
    // just not a ref-number one anymore.
    const refNo = await nextRefNo(prisma, "ADJ");

    const result = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product || !isProductRequestable(product.archivedAt)) {
            throw new Error("Product not found or archived");
          }

          const qtyBefore = product.stocks;
          const delta = qtyAfter - qtyBefore;
          if (delta === 0) {
            throw new Error("The corrected count matches the current stock — nothing to adjust");
          }

          const adjustment = await tx.stockAdjustment.create({
            data: {
              refNo,
              productId,
              qtyBefore,
              qtyAfter,
              delta,
              reason,
              note: note || null,
              byUserId: auth.session.user.id,
            },
          });

          await tx.product.update({
            where: { id: productId },
            data: { stocks: qtyAfter },
          });

          const sign = delta > 0 ? "+" : "";
          await tx.activityLog.create({
            data: {
              userId: auth.session.user.id,
              action: `Adjusted stock on ${product.name} — ${qtyBefore} → ${qtyAfter} (${sign}${delta}, ${REASON_LABELS[reason] ?? reason})`,
              refNo,
            },
          });

          return {
            adjustment,
            crossedThreshold: qtyBefore > product.minLevel && qtyAfter <= product.minLevel,
            productName: product.name,
            minLevel: product.minLevel,
          };
        },
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
      )
    );

    if (result.crossedThreshold) {
      await notifyLowStock({
        productId: result.adjustment.productId,
        productName: result.productName,
        stocks: result.adjustment.qtyAfter,
        minLevel: result.minLevel,
        excludeUserId: auth.session.user.id,
      });
    }

    revalidateAfterMutation(["inventory", "products", "adjustments"]);
    return NextResponse.json({ refNo: result.adjustment.refNo, delta: result.adjustment.delta }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stock adjustment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
