import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getSettingsData } from "@/lib/data/settings";

export default async function SettingsPage() {
  const [session, data] = await Promise.all([auth(), getSettingsData()]);
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("settings", role)}
        subtitle={screenSubtitleForRole("settings", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <SettingsScreen initialData={data} />
      </ScreenBody>
    </>
  );
}
