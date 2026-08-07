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
            // Data here comes from Neon over a real network hop — avoid
            // re-fetching (and re-showing a spinner) every time a screen
            // the user just visited is revisited within a short window.
            staleTime: 45_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
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
