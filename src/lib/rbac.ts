import type { Role } from "@/generated/prisma";

// README "RBAC (exact matrix from prototype)"
export const MODULE_ACCESS: Record<Role, string[]> = {
  OWNER: [
    "dashboard",
    "inventory",
    "products",
    "suppliers",
    "adjustments",
    "stock",
    "technicians",
    "reports",
    "users",
    "permissions",
    "activity",
    "settings",
  ],
  ADMIN: [
    "dashboard",
    "inventory",
    "products",
    "suppliers",
    "adjustments",
    "stock",
    "technicians",
    "reports",
    "activity",
  ],
  WAREHOUSE_STAFF: ["dashboard", "inventory", "adjustments", "stock"],
  TECHNICIAN: ["dashboard", "stock"],
};

export function canAccess(role: Role, moduleSegment: string): boolean {
  return MODULE_ACCESS[role]?.includes(moduleSegment) ?? false;
}

export class ForbiddenError extends Error {}

export function assertCanAccess(role: Role, moduleSegment: string): void {
  if (!canAccess(role, moduleSegment)) {
    throw new ForbiddenError(`Role ${role} cannot access ${moduleSegment}`);
  }
}
