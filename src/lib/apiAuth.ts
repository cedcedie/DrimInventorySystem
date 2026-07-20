import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";

export async function requireModuleAccess(moduleSegment: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  const role = session.user.role as Role;
  if (!canAccess(role, moduleSegment)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { session, role } as const;
}

export function isOwnerOrAdmin(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}
