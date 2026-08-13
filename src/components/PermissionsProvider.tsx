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
  role,
  children,
}: {
  permissions: PermissionsMap;
  /** Current role as computed server-side — used only to detect a role
   * change out from under an open tab; not read for permission checks. */
  role?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [live, setLive] = useState(permissions);

  useEffect(() => {
    setLive((prev) => (permissionsEqual(prev, permissions) ? prev : permissions));
  }, [permissions]);

  // Poll our own effective permissions so a change an Owner makes (role
  // defaults or a per-user override) reaches this tab within ~45s without
  // the affected user having to navigate or reload — server-side enforcement
  // is already immediate on every API call; this closes the client-UI gap
  // (buttons/nav staying stale) that server enforcement alone doesn't cover.
  const { data: polled } = useQuery({
    queryKey: queryKeys.myPermissions,
    queryFn: () => fetchJson<{ role: string; permissions: PermissionsMap }>("/api/me/permissions"),
    ...liveCool,
  });

  useEffect(() => {
    if (!polled) return;
    setLive((prev) => (permissionsEqual(prev, polled.permissions) ? prev : polled.permissions));
    // A role change (not just a permission edit) also changes which nav
    // segments this user may see — that's computed server-side in the (app)
    // layout, so a client-side permission sync alone can't catch it. Force a
    // server re-render to recompute accessSegments / redirect off a page the
    // new role can no longer reach, instead of leaving stale nav items up.
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

/** True when the current user may perform `action` on `module`.
 * Falls back to false when the module has no entry (unconfigurable / unknown). */
export function useCan(module: string, action: keyof PermissionSet = "canView"): boolean {
  const { permissions } = useContext(PermissionsContext);
  return permissions[module]?.[action] ?? false;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
