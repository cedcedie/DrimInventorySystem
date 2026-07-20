import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { TechniciansScreen } from "@/components/screens/TechniciansScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getTechniciansData } from "@/lib/data/technicians";

export default async function TechniciansPage() {
  const [session, data] = await Promise.all([auth(), getTechniciansData()]);
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("technicians", role)}
        subtitle={screenSubtitleForRole("technicians", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <TechniciansScreen role={role} initialData={data} />
      </ScreenBody>
    </>
  );
}
