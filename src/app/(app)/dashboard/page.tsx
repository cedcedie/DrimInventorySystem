import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getDashboardData } from "@/lib/data/dashboard";

export const metadata: Metadata = {
  title: "Dashboard — DRIM Inventory System",
};

export default async function DashboardPage() {
  const [session, data] = await Promise.all([auth(), getDashboardData()]);
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("dashboard", role)}
        subtitle={screenSubtitleForRole("dashboard", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <DashboardScreen role={role} initialData={data} />
      </ScreenBody>
    </>
  );
}
