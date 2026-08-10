import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma";
import { Alert } from "@mui/material";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { StockScreen } from "@/components/screens/StockScreen";
import { MrfScreen } from "@/components/screens/MrfScreen";
import { getTechnicianForUser } from "@/lib/data/mrf";
import { screenTitleForRole, screenSubtitleForRole } from "@/lib/navConfig";

export const metadata: Metadata = {
  title: "Stock — DRIM Inventory System",
};

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const role = session!.user.role as Role;

  if (role === "TECHNICIAN") {
    return (
      <>
        <ScreenHeader
          title={screenTitleForRole("stock", role)}
          subtitle={screenSubtitleForRole("stock", role)}
        />
        <ScreenBody>{await renderTechnicianView(session!.user.id)}</ScreenBody>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="Stock & Material Requests" subtitle="Open requests, receipts (SI), and releases (SO)" />
      <ScreenBody>
        <StockScreen role={role} initialTab={params.tab} />
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
