export const queryKeys = {
  dashboard: ["dashboard"] as const,
  inventory: (params: { q?: string; category?: string; page?: number }) =>
    ["inventory", params] as const,
  products: (params: { page?: number }) => ["products", params] as const,
  suppliers: ["suppliers"] as const,
  technicians: ["technicians"] as const,
  users: (params: { page?: number }) => ["users", params] as const,
  userHistory: (userId: string) => ["users", userId, "history"] as const,
  activity: (params: { page?: number }) => ["activity", params] as const,
  settings: ["settings"] as const,
  profile: ["profile"] as const,
  reports: ["reports"] as const,
  stockIn: (params: { page?: number }) => ["stock-in", params] as const,
  stockOut: (params: { page?: number }) => ["stock-out", params] as const,
  stockOptions: ["stock-options"] as const,
  mrf: ["mrf"] as const,
};
