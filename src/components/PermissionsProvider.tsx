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
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { liveCool } from "@/lib/liveQuery";
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
  /** Patch one module in-place after saving role/overrides. */
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
  role,
  children,
}: {
  permissions: PermissionsMap;
  /** Server-computed role — used only to detect a role change under an open tab. */
  role?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [live, setLive] = useState(permissions);

  useEffect(() => {
    setLive((prev) => (permissionsEqual(prev, permissions) ? prev : permissions));
  }, [permissions]);

  // Polls effective permissions so an Owner's role/override change reaches this tab
  // (~45s) without reload — closes the client-UI staleness gap; server enforcement
  // is already immediate.
  const { data: polled } = useQuery({
    queryKey: queryKeys.myPermissions,
    queryFn: () => fetchJson<{ role: string; permissions: PermissionsMap }>("/api/me/permissions"),
    ...liveCool,
  });

  useEffect(() => {
    if (!polled) return;
    setLive((prev) => (permissionsEqual(prev, polled.permissions) ? prev : polled.permissions));
    // A role change also changes visible nav segments (computed server-side);
    // force a re-render to recompute accessSegments / redirect off a now-forbidden page.
    if (role && polled.role !== role) {
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polled, role]);

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

/** True when the current user may perform `action` on `module`; false if unconfigured. */
export function useCan(module: string, action: keyof PermissionSet = "canView"): boolean {
  const { permissions } = useContext(PermissionsContext);
  return permissions[module]?.[action] ?? false;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
