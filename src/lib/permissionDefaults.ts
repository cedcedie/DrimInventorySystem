/** Shared source of truth for the configurable permission system.
 * Role defaults apply to everyone with the role; a user-specific override
 * (Permission row) entirely replaces the role default for that module. */

export const PERMISSION_MODULES = [
  "dashboard",
  "inventory",
  "products",
  "stock",
  "mrf",
  "suppliers",
  "technicians",
  "users",
  "reports",
] as const;

export const PERMISSION_ROLES = [
  { id: "OWNER", name: "OWNER", label: "Owner" },
  { id: "ADMIN", name: "ADMIN", label: "Admin" },
  { id: "WAREHOUSE_STAFF", name: "WAREHOUSE_STAFF", label: "Warehouse Staff" },
  { id: "TECHNICIAN", name: "TECHNICIAN", label: "Technician" },
] as const;

export interface PermissionSet {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export type PermissionAction = keyof PermissionSet;

export function isConfigurableModule(segment: string): boolean {
  return (PERMISSION_MODULES as readonly string[]).includes(segment);
}

export function defaultPermissionsFor(roleName: string, module: string): PermissionSet {
  if (roleName === "OWNER") {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true };
  }
  if (roleName === "ADMIN") {
    const isUsers = module === "users";
    return {
      canView: !isUsers,
      canCreate: !isUsers,
      canEdit: !isUsers,
      canDelete: !isUsers,
      canExport: !isUsers,
    };
  }
  if (roleName === "WAREHOUSE_STAFF") {
    const canManage = ["inventory", "stock"].includes(module);
    return {
      canView: ["dashboard", "inventory", "products", "stock"].includes(module),
      canCreate: canManage || module === "stock",
      canEdit: canManage,
      canDelete: false,
      canExport: false,
    };
  }
  if (roleName === "TECHNICIAN") {
    return {
      canView: ["dashboard", "mrf"].includes(module),
      canCreate: module === "mrf",
      canEdit: false,
      canDelete: false,
      canExport: false,
    };
  }
  return { canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false };
}
