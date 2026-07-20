import { PERM_SUMMARY, ROLE_LABELS } from "@/lib/navConfig";

export async function getSettingsData() {
  return {
    company: {
      name: "DRIM Refrigeration & Industrial Services",
      warehouseLocation: "Km. 7, Diversion Road, Davao City",
      currency: "PHP — Philippine Peso (₱)",
    },
    permRows: (Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((role) => ({
      role: ROLE_LABELS[role],
      perms: PERM_SUMMARY[role],
    })),
  };
}

export type SettingsData = Awaited<ReturnType<typeof getSettingsData>>;
