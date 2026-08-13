import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/effectivePermissions";
import type { Role } from "@/generated/prisma";

/** Polled client-side so a permission change (role-level or per-user override)
 * lands in the UI without the affected user having to navigate or reload —
 * matches the same near-live standard the rest of the app holds itself to.
 * Cheap: getEffectivePermissions is itself tag-cached and already the source
 * of truth every mutating API route re-derives from on every request. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Also re-reads role/status fresh from the DB, not just the (up to 60s stale)
  // session JWT — so a role change or deactivation surfaces here immediately
  // even before the session token itself catches up.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account deactivated" }, { status: 401 });
  }

  const permissions = await getEffectivePermissions(session.user.id, user.role as Role);
  return NextResponse.json({ role: user.role, permissions });
}
