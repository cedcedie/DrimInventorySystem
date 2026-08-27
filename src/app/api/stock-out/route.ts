import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockOutData } from "@/lib/data/stock";
import { prisma } from "@/lib/prisma";
import { notifyTechMrfUpdate, notifyLowStock } from "@/lib/notifications";
import { nextRefNo, withSerializableRetry } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { fulfillMrfItemInTx } from "@/lib/stockOutFulfill";
import { parseBody } from "@/lib/validate";
import { stockOutSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getStockOutData({
    page: Number(searchParams.get("page") ?? "1"),
    q: searchParams.get("q") ?? undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("stock", "canCreate");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, stockOutSchema);
  if ("error" in parsed) return parsed.error;
  const { mrfItemId, qty: quantity } = parsed.data;

  try {
    // Ref number comes from the atomic RefCounter, outside this transaction —
    // see the comment in src/app/api/mrf/route.ts for why it must not run
    // inside a Serializable-isolation transaction.
    const refNo = await nextRefNo(prisma, "SO");
    const result = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) =>
          fulfillMrfItemInTx(tx, {
            mrfItemId,
            quantity,
            byUserId: auth.session.user.id,
            refNo,
          }),
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
      )
    );

    const tech = await prisma.technician.findUnique({
      where: { id: result.technicianId },
      select: { userId: true },
    });
    await notifyTechMrfUpdate({
      technicianUserId: tech?.userId,
      type: "mrf_fulfilled",
      mrfRefNo: result.mrfRefNo,
      body: `Warehouse released ${result.qty} × ${result.productName} for ${result.project}`,
    });
    if (result.lowStockCrossed) {
      await notifyLowStock({ ...result.lowStockCrossed, excludeUserId: auth.session.user.id });
    }

    revalidateAfterMutation(["inventory", "products", "stock-out", "mrf"]);
    return NextResponse.json({ refNo: result.refNo }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stock Out failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
