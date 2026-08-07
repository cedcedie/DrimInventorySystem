import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma";
import { Alert } from "@mui/material";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { StockScreen } from "@/components/screens/StockScreen";
import { MrfScreen } from "@/components/screens/MrfScreen";
import { getTechnicianForUser } from "@/lib/data/mrf";

export const metadata: Metadata = {
  title: "Stock — DRIM Inventory System",
};

export default async function StockPage() {
  const session = await auth();
  const role = session!.user.role as Role;

  if (role === "TECHNICIAN") {
    return (
      <>
        <ScreenHeader
          title="Material Requests"
          subtitle="File and track your MRFs"
        />
        <ScreenBody>{await renderTechnicianView(session!.user.id)}</ScreenBody>
      </>
    );
  }

  return (
    <ScreenBody>
      <StockScreen role={role} />
    </ScreenBody>
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
