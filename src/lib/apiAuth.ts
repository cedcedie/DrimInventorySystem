import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { getEffectivePermissions } from "@/lib/effectivePermissions";
import { isConfigurableModule, type PermissionAction } from "@/lib/permissionDefaults";

/** Guards an API route. Configurable modules (products, stock, users, …) are
 * checked against the Owner-managed permission matrix (user override → role
 * config → default); segments outside the matrix (settings, activity, …) fall
 * back to the static role map. Pass `action` to additionally require
 * create/edit/delete/export rights for mutations.
 *
 * Technicians must use `mrf` (not `stock`) for their own request APIs. Stock
 * routes stay warehouse-scoped — do not bridge tech `mrf.canView` into stock. */
export async function requireModuleAccess(moduleSegment: string, action?: PermissionAction) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  const role = session.user.role as Role;

  if (isConfigurableModule(moduleSegment)) {
    // Technicians never use warehouse stock APIs — matrix stock.canView must not
    // reopen SI/SO/open-queue. They reach products via /api/stock/options dual-gate.
    if (moduleSegment === "stock" && role === "TECHNICIAN") {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
    }
    const perms = await getEffectivePermissions(session.user.id, role);
    if (!perms[moduleSegment]?.canView) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
    }
    if (action && action !== "canView" && !perms[moduleSegment]?.[action]) {
      return {
        error: NextResponse.json(
          { error: "Your permissions don't allow this action" },
          { status: 403 }
        ),
      } as const;
    }
  } else if (!canAccess(role, moduleSegment)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }

  return { session, role } as const;
}

export function isOwnerOrAdmin(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}
