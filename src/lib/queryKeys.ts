export const queryKeys = {
  dashboard: ["dashboard"] as const,
  inventory: (params: { code?: string; name?: string; category?: string; page?: number }) =>
    ["inventory", params] as const,
  products: (params: { page?: number; q?: string; category?: string }) => ["products", params] as const,
  suppliers: (params: { page?: number }) => ["suppliers", params] as const,
  technicians: (params: { page?: number }) => ["technicians", params] as const,
  users: (params: { page?: number }) => ["users", params] as const,
  userHistory: (userId: string) => ["users", userId, "history"] as const,
  activity: (params: { page?: number; user?: string; action?: string; ref?: string }) => ["activity", params] as const,
  settings: ["settings"] as const,
  profile: ["profile"] as const,
  reports: ["reports"] as const,
  stockIn: (params: { page?: number; item?: string; supplier?: string; refNo?: string; date?: string; receivedBy?: string }) =>
    ["stock-in", params] as const,
  stockOut: (params: { page?: number; mrfNumber?: string; date?: string; item?: string; project?: string; technician?: string }) =>
    ["stock-out", params] as const,
  stockOptions: ["stock-options"] as const,
  mrf: (params: { page?: number }) => ["mrf", params] as const,
  openMrfs: (
    params: { page?: number; mrfNumber?: string; project?: string; item?: string; technician?: string } = {}
  ) => ["mrf-open", params] as const,
  adjustments: (params: { page?: number; refNo?: string; product?: string; note?: string; user?: string }) =>
    ["adjustments", params] as const,
  notifications: ["notifications"] as const,
  myPermissions: ["me-permissions"] as const,
  purchaseOrders: (params: { page?: number; refNo?: string; supplier?: string; item?: string; filedBy?: string }) =>
    ["purchase-orders", params] as const,
  purchaseRequests: (params: { page?: number; refNo?: string; supplier?: string; item?: string; filedBy?: string }) =>
    ["purchase-requests", params] as const,
};
