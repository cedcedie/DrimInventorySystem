import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { getEffectivePermissions } from "@/lib/effectivePermissions";
import { isConfigurableModule, type PermissionAction } from "@/lib/permissionDefaults";

/** Guards an API route. Configurable modules check the Owner-managed permission
 * matrix (user override → role config → default); others fall back to the static
 * role map. Technicians must use `mrf`, not `stock` — do not bridge tech
 * `mrf.canView` into stock, which stays warehouse-scoped. */
export async function requireModuleAccess(moduleSegment: string, action?: PermissionAction) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  const role = session.user.role as Role;

  if (isConfigurableModule(moduleSegment)) {
    // Technicians never use warehouse stock APIs, even if stock.canView is set.
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
