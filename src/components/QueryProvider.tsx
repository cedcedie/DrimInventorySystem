"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Multi-user warehouse: prefer freshness over aggressive client caching.
            // Screens that need continuous sync also set refetchInterval via liveQueryOptions.
            staleTime: 4_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
          mutations: {
            // Don't retry writes — inventory mutations aren't idempotent.
            retry: 0,
          },
        },
      })
  );
  return (
    <SessionProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
