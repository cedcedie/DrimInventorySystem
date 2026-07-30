import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { nextRefNo } from "@/lib/refNo";
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
  });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("inventory");
  if ("error" in auth) return auth.error;
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json(
      { error: "Only Owner or Admin can adjust stock" },
      { status: 403 }
    );
  }

  const parsed = await parseBody(req, stockAdjustmentSchema);
  if ("error" in parsed) return parsed.error;
  const { productId, qtyAfter, reason, note } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error("Product not found");

        const qtyBefore = product.stocks;
        const delta = qtyAfter - qtyBefore;
        if (delta === 0) {
          throw new Error("The corrected count matches the current stock — nothing to adjust");
        }

        const refNo = await nextRefNo(tx, "stockAdjustment", "ADJ");

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

        return adjustment;
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
    );

    revalidateAfterMutation(["inventory", "products", "adjustments"]);
    return NextResponse.json({ refNo: result.refNo, delta: result.delta }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stock adjustment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
