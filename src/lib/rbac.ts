import type { Role } from "@/generated/prisma";

// README "RBAC (exact matrix from prototype)"
// "activity-feed" is deliberately on every role's list — it's the shared,
// system-wide operational timeline everyone sees (see ActivityLog.sensitive
// for what's excluded from it at the data layer), unlike "activity" (the
// full unfiltered audit log, Owner/Admin only).
export const MODULE_ACCESS: Record<Role, string[]> = {
  OWNER: [
    "dashboard",
    "inventory",
    "products",
    "suppliers",
    "purchaseOrders",
    "adjustments",
    "stock",
    "technicians",
    "reports",
    "users",
    "permissions",
    "activity",
    "activity-feed",
    "settings",
  ],
  ADMIN: [
    "dashboard",
    "inventory",
    "products",
    "suppliers",
    "purchaseOrders",
    "adjustments",
    "stock",
    "technicians",
    "reports",
    "activity",
    "activity-feed",
  ],
  WAREHOUSE_STAFF: ["dashboard", "inventory", "adjustments", "stock", "purchaseOrders", "activity-feed"],
  TECHNICIAN: ["dashboard", "stock", "activity-feed"],
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
