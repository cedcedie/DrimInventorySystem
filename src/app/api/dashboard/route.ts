import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getDashboardData } from "@/lib/data/dashboard";
import { getTechnicianForUser } from "@/lib/data/mrf";

export async function GET() {
  const auth = await requireModuleAccess("dashboard");
  if ("error" in auth) return auth.error;

  if (auth.role === "TECHNICIAN") {
    const technician = await getTechnicianForUser(auth.session.user.id);
    // Always tech-scoped — never fall through to warehouse dashboard if unlinked.
    return NextResponse.json(await getDashboardData(technician?.id ?? "__none__"));
  }

  return NextResponse.json(await getDashboardData());
}
