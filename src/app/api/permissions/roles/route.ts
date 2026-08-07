import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import {
  PERMISSION_MODULES,
  PERMISSION_ROLES,
  defaultPermissionsFor,
} from "@/lib/permissionDefaults";

export async function GET() {
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Permission management requires Owner role" }, { status: 403 });
  }

  try {
    // Saved role permissions override the built-in defaults.
    const saved = await prisma.rolePermission.findMany({
      include: { roleDef: { select: { name: true } } },
    });

    const permissions = PERMISSION_ROLES.flatMap((role) =>
      PERMISSION_MODULES.map((module) => {
        const row = saved.find((s) => s.roleDef.name === role.name && s.module === module);
        const perms = row ?? defaultPermissionsFor(role.name, module);
        return {
          roleId: role.id,
          roleName: role.name,
          module,
          canView: perms.canView,
          canCreate: perms.canCreate,
          canEdit: perms.canEdit,
          canDelete: perms.canDelete,
          canExport: perms.canExport,
        };
      })
    );

    return NextResponse.json({ roles: PERMISSION_ROLES, permissions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch permissions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
