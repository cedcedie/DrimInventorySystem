"use client";

import { createContext, useContext } from "react";
import type { PermissionSet } from "@/lib/permissionDefaults";

type PermissionsMap = Record<string, PermissionSet>;

const PermissionsContext = createContext<PermissionsMap>({});

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: PermissionsMap;
  children: React.ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>
  );
}

/** True when the current user may perform `action` on `module`.
 * Falls back to false when the module has no entry (unconfigurable / unknown). */
export function useCan(module: string, action: keyof PermissionSet = "canView"): boolean {
  const perms = useContext(PermissionsContext);
  return perms[module]?.[action] ?? false;
}
