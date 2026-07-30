import type { Role } from "@prisma/client";

export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { segment: "dashboard", label: "Dashboard" },
      { segment: "activity", label: "Activity Log" },
    ],
  },
  {
    label: "Warehouse",
    items: [
      { segment: "inventory", label: "Inventory" },
      { segment: "products", label: "Products/Materials" },
      { segment: "suppliers", label: "Suppliers" },
      { segment: "stock", label: "Stock In/Out" },
    ],
  },
  {
    label: "People & Admin",
    items: [
      { segment: "technicians", label: "Technicians" },
      { segment: "reports", label: "Reports" },
      { segment: "users", label: "Users" },
      { segment: "settings", label: "Settings" },
    ],
  },
] as const;

export const SCREEN_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  products: "Products/Materials",
  suppliers: "Suppliers",
  stock: "Stock In/Out",
  technicians: "Technicians",
  reports: "Reports",
  users: "Users",
  activity: "Activity Log",
  settings: "Settings",
  profile: "My Account",
};

export const SCREEN_SUBTITLES: Record<string, string> = {
  dashboard: "Live overview of stock movement and alerts",
  inventory: "Stock on hand by product and category",
  products: "Master product catalog",
  suppliers: "Accredited supplier registry",
  stock: "Record incoming and outgoing stock",
  technicians: "Field personnel and their transactions",
  reports: "Generate and export operational reports",
  users: "System accounts and roles",
  activity: "Complete audit trail of system actions",
  settings: "Company profile and system configuration",
  profile: "Your display name and password",
};

// Stock In/Out renders as Material Requests (MRF) for technicians per README RBAC note.
export function screenTitleForRole(segment: string, role: Role): string {
  if (segment === "stock" && role === "TECHNICIAN") return "Material Requests (MRF)";
  return SCREEN_TITLES[segment] ?? segment;
}

export function screenSubtitleForRole(segment: string, role: Role): string {
  if (segment === "stock" && role === "TECHNICIAN") {
    return "File and track your material requests";
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
