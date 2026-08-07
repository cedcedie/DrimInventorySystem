import { prisma } from "@/lib/prisma";
import { PERM_SUMMARY, ROLE_LABELS } from "@/lib/navConfig";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const COMPANY_DEFAULTS = {
  name: "DRIM Refrigeration & Industrial Services",
  warehouseLocation: "Km. 7, Diversion Road, Davao City",
  currency: "PHP — Philippine Peso (₱)",
};

/** The company profile is a single pinned row. Reads fall back to the seed
 * defaults so a database that hasn't been seeded still renders sensibly. */
export async function getCompanySettings() {
  const row = await prisma.companySettings.findUnique({ where: { id: "singleton" } });
  return {
    name: row?.name ?? COMPANY_DEFAULTS.name,
    warehouseLocation: row?.warehouseLocation ?? COMPANY_DEFAULTS.warehouseLocation,
    currency: row?.currency ?? COMPANY_DEFAULTS.currency,
  };
}

export async function getSettingsData() {
  "use cache";
  tagAndLife("settings", CACHE_SECONDS.settings);

  return {
    company: await getCompanySettings(),
    permRows: (Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((role) => ({
      role: ROLE_LABELS[role],
      perms: PERM_SUMMARY[role],
    })),
  };
}

export type SettingsData = Awaited<ReturnType<typeof getSettingsData>>;
