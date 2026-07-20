import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { productMinLevelSchema } from "@/lib/schemas";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("inventory");
  if ("error" in auth) return auth.error;
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Only Owner can set the minimum stock level" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = await parseBody(req, productMinLevelSchema);
  if ("error" in parsed) return parsed.error;
  const { minLevel } = parsed.data;

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
