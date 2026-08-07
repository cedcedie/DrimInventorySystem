import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import {
  getEffectivePermissions,
  isConfigurableModule,
  type PermissionAction,
} from "@/lib/effectivePermissions";

/** Guards an API route. Configurable modules (products, stock, users, …) are
 * checked against the Owner-managed permission matrix (user override → role
 * config → default); segments outside the matrix (settings, activity, …) fall
 * back to the static role map. Pass `action` to additionally require
 * create/edit/delete/export rights for mutations. */
export async function requireModuleAccess(moduleSegment: string, action?: PermissionAction) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  const role = session.user.role as Role;

  if (isConfigurableModule(moduleSegment)) {
    const perms = await getEffectivePermissions(session.user.id, role);
    // The "stock" segment doubles as the MRF screen for technicians, so MRF
    // view rights also grant access to the shared stock endpoints.
    const canView =
      perms[moduleSegment]?.canView ||
      (moduleSegment === "stock" && perms.mrf?.canView) ||
      false;
    if (!canView) {
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
