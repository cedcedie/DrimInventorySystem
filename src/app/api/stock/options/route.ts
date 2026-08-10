import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effectivePermissions";
import { getMrfFilingProductOptions, getStockFormOptions } from "@/lib/data/stock";

/** Warehouse gets full SI/SO options (incl. open MRF lines). Technicians with
 * MRF create rights get active products only — never the warehouse-wide queue. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  const perms = await getEffectivePermissions(session.user.id, role);

  if (perms.stock?.canView && role !== "TECHNICIAN") {
    return NextResponse.json(await getStockFormOptions());
  }

  if (role === "TECHNICIAN" && perms.mrf?.canCreate) {
    return NextResponse.json(await getMrfFilingProductOptions());
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
