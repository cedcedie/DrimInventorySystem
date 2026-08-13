import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { z } from "zod";
import { revalidatePermissions } from "@/lib/revalidate";
import { PERMISSION_ROLES } from "@/lib/permissionDefaults";

const updatePermissionSchema = z.object({
  roleId: z.string().min(1),
  module: z.string().min(1),
  permissions: z.object({
    canView: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canExport: z.boolean(),
  }),
});

export async function POST(req: Request) {
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Permission management requires Owner role" }, { status: 403 });
  }

  const parsed = await parseBody(req, updatePermissionSchema);
  if ("error" in parsed) return parsed.error;

  const { roleId, module, permissions } = parsed.data;
  const roleMeta = PERMISSION_ROLES.find((r) => r.id === roleId);
  if (!roleMeta) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }

  // Guard against an Owner locking every Owner out of Users/Permissions by
  // revoking the OWNER role's own view access to the "users" module —
  // there's no other route back in once that happens.
  if (roleMeta.name === "OWNER" && module === "users" && !permissions.canView) {
    return NextResponse.json(
      { error: "The Owner role must always be able to view the Users module" },
      { status: 409 }
    );
  }

  try {
    // RoleDef rows are created lazily the first time a role's permissions are edited.
    const roleDef = await prisma.roleDef.upsert({
      where: { name: roleMeta.name },
      update: {},
      create: { name: roleMeta.name, displayName: roleMeta.label, isSystem: true },
    });

    await prisma.rolePermission.upsert({
      where: { roleDefId_module: { roleDefId: roleDef.id, module } },
      update: permissions,
      create: { roleDefId: roleDef.id, module, ...permissions },
    });

    const grants = (Object.keys(permissions) as Array<keyof typeof permissions>)
      .filter((k) => permissions[k])
      .join(", ") || "none";
    await prisma.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: `Set ${roleMeta.label} role's ${module} permissions — ${grants}`,
        refNo: roleMeta.name,
      },
    });

    revalidatePermissions();

    return NextResponse.json({ success: true, message: "Permissions updated" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update permissions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
