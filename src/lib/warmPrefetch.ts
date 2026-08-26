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

function whenIdle(fn: () => void, delayMs = 3000) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    const ric = window.requestIdleCallback?.bind(window);
    if (ric) ric(fn, { timeout: 5000 });
    else fn();
  }, delayMs);
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
    // Navigation still proceeds; dashboard page can load its own data.
  }
}

/** Deferred so the first navigation isn't competing with warm-up. */
export function warmShellRoutes(
  router: AppRouterInstance,
  queryClient: QueryClient,
  accessSegments: string[]
) {
  whenIdle(() => {
    const routes = PRIORITY_SEGMENTS.filter((seg) => accessSegments.includes(seg));
    routes.forEach((seg, index) => {
      window.setTimeout(() => router.prefetch(`/${seg}`), index * 400);
    });

    if (accessSegments.includes("inventory")) {
      window.setTimeout(() => {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.inventory({ q: "", category: "All", page: 1 }),
          queryFn: () =>
            fetchJson<InventoryData>(
              `/api/inventory?q=${encodeURIComponent("")}&category=${encodeURIComponent("All")}&page=1`
            ),
          staleTime: 8_000,
        });
      }, 1200);
    }

    if (accessSegments.includes("products")) {
      window.setTimeout(() => {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.products({ page: 1, q: "", category: "All" }),
          queryFn: () =>
            fetchJson<ProductsData>(
              `/api/products?page=1&q=${encodeURIComponent("")}&category=${encodeURIComponent("All")}`
            ),
          staleTime: 8_000,
        });
      }, 1800);
    }
  });
}
