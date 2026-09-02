import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTechnicianCatalog } from "@/lib/data/technicians";

/** Lightweight name list for the "Technician" filter dropdowns across search
 * screens — any signed-in user can read it (it's just names), unlike the
 * full Technicians module endpoint which is gated per-module. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getTechnicianCatalog());
}
