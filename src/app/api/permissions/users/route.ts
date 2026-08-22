import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

/** Lists accounts with role and any user-specific permission overrides. */
export async function GET() {
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Permission management requires Owner role" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        permissions: {
          select: {
            module: true,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canExport: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
