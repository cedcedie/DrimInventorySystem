import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { ActivityFeedScreen } from "@/components/screens/ActivityFeedScreen";
import { screenTitleForRole, screenSubtitleForRole } from "@/lib/navConfig";
import { getActivityFeedData } from "@/lib/data/activityFeed";

export const metadata: Metadata = {
  title: "Activity Feed — DRIM Inventory System",
};

export default async function ActivityFeedPage() {
  const [session, data] = await Promise.all([auth(), getActivityFeedData({})]);
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("activity-feed", role)}
        subtitle={screenSubtitleForRole("activity-feed", role)}
      />
      <ScreenBody>
        <ActivityFeedScreen initialData={data} />
      </ScreenBody>
    </>
  );
}
