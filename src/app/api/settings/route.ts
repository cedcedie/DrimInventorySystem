import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getSettingsData } from "@/lib/data/settings";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { companySettingsSchema } from "@/lib/schemas";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function GET() {
  const auth = await requireModuleAccess("settings");
  if ("error" in auth) return auth.error;

  return NextResponse.json(await getSettingsData());
}

export async function PATCH(req: Request) {
  // Only OWNER has "settings" in MODULE_ACCESS, so reaching here implies Owner.
  const auth = await requireModuleAccess("settings");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, companySettingsSchema);
  if ("error" in parsed) return parsed.error;
  const { name, warehouseLocation, currency } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.companySettings.upsert({
      where: { id: "singleton" },
      update: { name, warehouseLocation, currency, updatedById: auth.session.user.id },
      create: {
        id: "singleton",
        name,
        warehouseLocation,
        currency,
        updatedById: auth.session.user.id,
      },
    });
    await tx.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: `Updated company profile — ${name}`,
        refNo: "SETTINGS",
      },
    });
  });

  revalidateAfterMutation(["settings"]);
  return NextResponse.json({ ok: true });
}
