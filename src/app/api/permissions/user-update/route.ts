import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { z } from "zod";
import { revalidatePermissions } from "@/lib/revalidate";

const userPermissionSchema = z.object({
  userId: z.string().min(1),
  module: z.string().min(1),
  /** null clears the override so the user falls back to their role's defaults. */
  permissions: z
    .object({
      canView: z.boolean(),
      canCreate: z.boolean(),
      canEdit: z.boolean(),
      canDelete: z.boolean(),
      canExport: z.boolean(),
    })
    .nullable(),
});

export async function POST(req: Request) {
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Permission management requires Owner role" }, { status: 403 });
  }

  const parsed = await parseBody(req, userPermissionSchema);
  if ("error" in parsed) return parsed.error;

  const { userId, module, permissions } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (permissions === null) {
      await prisma.permission.deleteMany({ where: { userId, module } });
    } else {
      await prisma.permission.upsert({
        where: { userId_module: { userId, module } },
        update: permissions,
        create: { userId, module, ...permissions },
      });
    }

    revalidatePermissions();

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update user permissions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
