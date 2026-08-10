import type { Role } from "@/generated/prisma";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  PERMISSION_MODULES,
  defaultPermissionsFor,
  type PermissionSet,
} from "@/lib/permissionDefaults";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

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
      result[mod] = {
        canView: userRow.canView,
        canCreate: userRow.canCreate,
        canEdit: userRow.canEdit,
        canDelete: userRow.canDelete,
        canExport: userRow.canExport,
      };
      continue;
    }
    const roleRow = roleRows.find((p) => p.module === mod);
    result[mod] = roleRow
      ? {
          canView: roleRow.canView,
          canCreate: roleRow.canCreate,
          canEdit: roleRow.canEdit,
          canDelete: roleRow.canDelete,
          canExport: roleRow.canExport,
        }
      : defaultPermissionsFor(role, mod);
  }
  return result;
}

/** Per-user effective map. Cached briefly; busted via the "permissions" tag.
 * Owner is included — saved role/user matrix rows override built-in defaults. */
export const getEffectivePermissions = cache(async (userId: string, role: Role) => {
  return loadEffectivePermissions(userId, role);
});

export type { PermissionAction } from "@/lib/permissionDefaults";
