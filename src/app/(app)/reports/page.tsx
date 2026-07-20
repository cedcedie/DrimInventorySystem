import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { ReportsScreen } from "@/components/screens/ReportsScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getDashboardData } from "@/lib/data/dashboard";

export const metadata: Metadata = {
  title: "Reports — DRIM Inventory System",
};

export default async function ReportsPage() {
  const [session, data] = await Promise.all([auth(), getDashboardData()]);
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("reports", role)}
        subtitle={screenSubtitleForRole("reports", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <ReportsScreen role={role} initialData={data} />
      </ScreenBody>
    </>
  );
}
