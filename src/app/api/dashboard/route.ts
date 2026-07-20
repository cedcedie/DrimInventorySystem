import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getDashboardData } from "@/lib/data/dashboard";

export async function GET() {
  const auth = await requireModuleAccess("dashboard");
  if ("error" in auth) return auth.error;

  return NextResponse.json(await getDashboardData());
}
