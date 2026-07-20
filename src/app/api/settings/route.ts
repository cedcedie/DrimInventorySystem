import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getSettingsData } from "@/lib/data/settings";

export async function GET() {
  const auth = await requireModuleAccess("settings");
  if ("error" in auth) return auth.error;

  return NextResponse.json(await getSettingsData());
}
