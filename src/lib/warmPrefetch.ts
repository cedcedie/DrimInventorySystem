"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { queryKeys } from "@/lib/queryKeys";
import { fetchJson } from "@/lib/api";
import type { DashboardData } from "@/lib/data/dashboard";
import type { InventoryData } from "@/lib/data/inventory";
import type { ProductsData } from "@/lib/data/products";

/** Routes most users hit first — RSC-prefetch only these, not the whole app. */
export const PRIORITY_SEGMENTS = ["dashboard", "inventory", "products", "stock"] as const;

function whenIdle(fn: () => void) {
  if (typeof window === "undefined") return;
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) ric(fn, { timeout: 2500 });
  else window.setTimeout(fn, 500);
}

/** Right after credentials succeed: warm dashboard RSC + React Query before navigating. */
export async function warmPostLogin(router: AppRouterInstance, queryClient: QueryClient) {
  router.prefetch("/dashboard");
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard,
      queryFn: () => fetchJson<DashboardData>("/api/dashboard"),
    });
  } catch {
    // Navigation still proceeds — dashboard page can load its own data.
  }
}

/**
 * Once the authenticated shell is up, idle-prefetch the next likely screens
 * the user is allowed to see (RSC + light API warm for inventory/products).
 */
export function warmShellRoutes(
  router: AppRouterInstance,
  queryClient: QueryClient,
  accessSegments: string[]
) {
  whenIdle(() => {
    for (const seg of PRIORITY_SEGMENTS) {
      if (accessSegments.includes(seg)) router.prefetch(`/${seg}`);
    }

    if (accessSegments.includes("inventory")) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.inventory({ q: "", category: "All", page: 1 }),
        queryFn: () =>
          fetchJson<InventoryData>(
            `/api/inventory?q=${encodeURIComponent("")}&category=${encodeURIComponent("All")}&page=1`
          ),
      });
    }
    if (accessSegments.includes("products")) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.products({ page: 1 }),
        queryFn: () => fetchJson<ProductsData>("/api/products?page=1"),
      });
    }
  });
}
