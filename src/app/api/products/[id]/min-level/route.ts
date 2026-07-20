import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("inventory");
  if ("error" in auth) return auth.error;
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Only Owner can set the minimum stock level" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const minLevel = Number(body.minLevel);
  if (!Number.isFinite(minLevel) || minLevel < 0) {
    return NextResponse.json({ error: "Invalid minimum stock level" }, { status: 400 });
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: { minLevel },
    });
    await tx.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: `Set min. stock level on ${updated.name} to ${minLevel}`,
        refNo: updated.code,
      },
    });
    return updated;
  });

  revalidateAfterMutation(["inventory", "products"]);
  return NextResponse.json({ id: product.id, minLevel: product.minLevel });
}
