import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { ActivityScreen } from "@/components/screens/ActivityScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getActivityData } from "@/lib/data/activity";

export const metadata: Metadata = {
  title: "Activity — DRIM Inventory System",
};

export default async function ActivityPage() {
  const session = await auth();
  const role = session!.user.role as Role;
  const data = await getActivityData({ role });

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("activity", role)}
        subtitle={screenSubtitleForRole("activity", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <ActivityScreen initialData={data} />
      </ScreenBody>
    </>
  );
}
