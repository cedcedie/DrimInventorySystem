import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { ActivityScreen } from "@/components/screens/ActivityScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getActivityData } from "@/lib/data/activity";

export default async function ActivityPage() {
  const [session, data] = await Promise.all([auth(), getActivityData({})]);
  const role = session!.user.role as Role;

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
