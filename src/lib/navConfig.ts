import type { Role } from "@/generated/prisma";

export const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { segment: "dashboard", label: "Dashboard" },
      { segment: "activity", label: "Activity Log" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { segment: "inventory", label: "Inventory" },
      { segment: "products", label: "Products" },
      { segment: "suppliers", label: "Suppliers" },
      { segment: "purchaseOrders", label: "Purchase Orders" },
      { segment: "adjustments", label: "Adjustments" },
    ],
  },
  {
    label: "Stock",
    items: [{ segment: "stock", label: "Stock & MRFs" }],
  },
  {
    label: "People",
    items: [
      { segment: "technicians", label: "Technicians" },
      { segment: "users", label: "Users" },
    ],
  },
  {
    label: "Admin",
    items: [
      { segment: "reports", label: "Reports" },
      { segment: "permissions", label: "Permissions" },
      { segment: "settings", label: "Settings" },
    ],
  },
] as const;

export const SCREEN_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  products: "Products/Materials",
  suppliers: "Suppliers",
  purchaseOrders: "Purchase Orders",
  adjustments: "Stock Adjustments",
  stock: "Stock & MRFs",
  technicians: "Technicians",
  reports: "Reports",
  users: "Users",
  permissions: "Role Permissions",
  activity: "Activity Log",
  settings: "Settings",
  profile: "My Account",
};

export const SCREEN_SUBTITLES: Record<string, string> = {
  dashboard: "Live overview of stock movement and alerts",
  inventory: "Stock on hand by product and category",
  products: "Master product catalog",
  suppliers: "Accredited supplier registry",
  purchaseOrders: "What's on order and not yet received",
  adjustments: "Manual stock count corrections with audit trail",
  stock: "Open material requests, receive (SI), and release (SO)",
  technicians: "Field personnel and their transactions",
  reports: "Generate and export operational reports",
  users: "System accounts and roles",
  permissions: "Configure what each role can access",
  activity: "What's happening across DRIM",
  settings: "Company profile and system configuration",
  profile: "Your display name and password",
};

// Stock & MRFs renders as Material Requests (MRF) for technicians per README RBAC note.
export function screenTitleForRole(segment: string, role: Role): string {
  if (segment === "stock" && role === "TECHNICIAN") return "Material Requests (MRF)";
  return SCREEN_TITLES[segment] ?? segment;
}

export function screenSubtitleForRole(segment: string, role: Role): string {
  if (segment === "stock" && role === "TECHNICIAN") {
    return "File and track your material requests";
  }
  if (segment === "dashboard" && role === "TECHNICIAN") {
    return "Your open material requests";
  }
  return SCREEN_SUBTITLES[segment] ?? "";
}

export const PERM_SUMMARY: Record<Role, string> = {
  OWNER: "View Inventory · Add / Edit / Delete Item · Set Min. Stock Level",
  ADMIN: "Stock In · Stock Out · Generate Report",
  WAREHOUSE_STAFF: "Stock In · Stock Out",
  TECHNICIAN: "File Material Request Form (MRF)",
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  WAREHOUSE_STAFF: "Warehouse Staff",
  TECHNICIAN: "Technician / Engineer",
};
