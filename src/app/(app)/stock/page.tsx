import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { Alert } from "@mui/material";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { StockScreen } from "@/components/screens/StockScreen";
import { MrfScreen } from "@/components/screens/MrfScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getTechnicianForUser } from "@/lib/data/mrf";

export default async function StockPage() {
  const session = await auth();
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("stock", role)}
        subtitle={screenSubtitleForRole("stock", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        {role === "TECHNICIAN" ? (
          await renderTechnicianView(session!.user.id)
        ) : (
          <StockScreen role={role} />
        )}
      </ScreenBody>
    </>
  );
}

async function renderTechnicianView(userId: string) {
  const technician = await getTechnicianForUser(userId);
  if (!technician) {
    return (
      <Alert severity="warning">
        No technician roster entry is linked to this account yet — contact an Owner to link it before
        filing material requests.
      </Alert>
    );
  }
  return (
    <MrfScreen
      technicianName={technician.name}
      empNo={technician.empNo}
      position={technician.position}
    />
  );
}
