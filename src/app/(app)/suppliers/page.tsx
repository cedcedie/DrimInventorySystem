import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { SuppliersScreen } from "@/components/screens/SuppliersScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getSuppliersData } from "@/lib/data/suppliers";

export const metadata: Metadata = {
  title: "Suppliers — DRIM Inventory System",
};

export default async function SuppliersPage() {
  const [session, data] = await Promise.all([auth(), getSuppliersData()]);
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("suppliers", role)}
        subtitle={screenSubtitleForRole("suppliers", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <SuppliersScreen role={role} initialData={data} />
      </ScreenBody>
    </>
  );
}
