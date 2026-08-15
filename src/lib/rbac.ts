import type { Role } from "@/generated/prisma";

// README "RBAC (exact matrix from prototype)"
// "activity" is on every role's list — it's the shared activity log
// everyone can see, filtered server-side by role (see getActivityData /
// ActivityLog.sensitive): Owner/Admin see every row including account/
// permission/company-config changes, every other role sees the same
// operational events (stock, MRF, purchase orders, catalog) with sensitive
// rows excluded. One page, one route, filtered by who's asking.
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
  ],
  WAREHOUSE_STAFF: ["dashboard", "inventory", "adjustments", "stock", "purchaseOrders", "activity"],
  TECHNICIAN: ["dashboard", "stock", "activity"],
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
