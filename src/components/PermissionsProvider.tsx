"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PermissionSet } from "@/lib/permissionDefaults";

type PermissionsMap = Record<string, PermissionSet>;

function permissionsEqual(a: PermissionsMap, b: PermissionsMap): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    const left = a[key];
    const right = b[key];
    if (!right) return false;
    if (
      left.canView !== right.canView ||
      left.canCreate !== right.canCreate ||
      left.canEdit !== right.canEdit ||
      left.canDelete !== right.canDelete ||
      left.canExport !== right.canExport
    ) {
      return false;
    }
  }

  return true;
}

type PermissionsContextValue = {
  permissions: PermissionsMap;
  /** Patch one module in-place (used after saving the current user's role/overrides). */
  patchModule: (module: string, set: PermissionSet | null) => void;
  replaceAll: (next: PermissionsMap) => void;
};

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: {},
  patchModule: () => {},
  replaceAll: () => {},
});

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: PermissionsMap;
  children: ReactNode;
}) {
  const [live, setLive] = useState(permissions);

  useEffect(() => {
    setLive((prev) => (permissionsEqual(prev, permissions) ? prev : permissions));
  }, [permissions]);

  const patchModule = useCallback((module: string, set: PermissionSet | null) => {
    setLive((prev) => {
      if (set === null) {
        const next = { ...prev };
        delete next[module];
        return next;
      }
      return { ...prev, [module]: set };
    });
  }, []);

  const replaceAll = useCallback((next: PermissionsMap) => {
    setLive(next);
  }, []);

  const value = useMemo(
    () => ({ permissions: live, patchModule, replaceAll }),
    [live, patchModule, replaceAll]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

/** True when the current user may perform `action` on `module`.
 * Falls back to false when the module has no entry (unconfigurable / unknown). */
export function useCan(module: string, action: keyof PermissionSet = "canView"): boolean {
  const { permissions } = useContext(PermissionsContext);
  return permissions[module]?.[action] ?? false;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
