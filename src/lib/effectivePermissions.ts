import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PERMISSION_MODULES,
  defaultPermissionsFor,
  type PermissionSet,
} from "@/lib/permissionDefaults";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

function fullAccess(): Record<string, PermissionSet> {
  const result: Record<string, PermissionSet> = {};
  for (const mod of PERMISSION_MODULES) {
    result[mod] = {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canExport: true,
    };
  }
  return result;
}

async function loadEffectivePermissions(userId: string, role: Role) {
  "use cache";
  tagAndLife("permissions", CACHE_SECONDS.permissions);

  const [roleRows, userRows] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { roleDef: { name: role } },
      select: {
        module: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
      },
    }),
    prisma.permission.findMany({
      where: { userId },
      select: {
        module: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
      },
    }),
  ]);

  const result: Record<string, PermissionSet> = {};
  for (const mod of PERMISSION_MODULES) {
    const userRow = userRows.find((p) => p.module === mod);
    if (userRow) {
      result[mod] = userRow;
      continue;
    }
    const roleRow = roleRows.find((p) => p.module === mod);
    result[mod] = roleRow ?? defaultPermissionsFor(role, mod);
  }
  return result;
}

/** Per-user effective map. Cached briefly; busted via the "permissions" tag.
 * Queries only this user's overrides + this role's saved rows (not the whole tables). */
export async function getEffectivePermissions(
  userId: string,
  role: Role
): Promise<Record<string, PermissionSet>> {
  if (role === "OWNER") return fullAccess();
  return loadEffectivePermissions(userId, role);
}

export type PermissionAction = keyof PermissionSet;

export function isConfigurableModule(segment: string): boolean {
  return (PERMISSION_MODULES as readonly string[]).includes(segment);
}
