import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getDashboardData } from "@/lib/data/dashboard";
import { getTechnicianForUser } from "@/lib/data/mrf";

export async function GET() {
  const auth = await requireModuleAccess("dashboard");
  if ("error" in auth) return auth.error;

  let technicianId: string | undefined;
  if (auth.role === "TECHNICIAN") {
    const technician = await getTechnicianForUser(auth.session.user.id);
    technicianId = technician?.id;
  }

  return NextResponse.json(await getDashboardData(technicianId));
}
