"use client";

import { useState, useRef, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { SessionProvider, signOut } from "next-auth/react";
import { ApiError } from "@/lib/api";

/** A 401 from a background-polled query or a mutation means the session died
 * server-side (expired, deactivated, role changed) — without this, polling
 * queries just fail silently forever and the screen quietly stops updating
 * with no explanation. Force back to login instead. Guarded so a burst of
 * simultaneously-failing polls only triggers one redirect. */
function useSessionExpiryHandler() {
  const handled = useRef(false);
  return (error: unknown) => {
    if (handled.current) return;
    if (error instanceof ApiError && error.status === 401) {
      handled.current = true;
      signOut({ callbackUrl: "/login?expired=1" });
    }
  };
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const onSessionExpiry = useSessionExpiryHandler();
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: onSessionExpiry }),
        mutationCache: new MutationCache({ onError: onSessionExpiry }),
        defaultOptions: {
          queries: {
            // Default: snappy nav without hammering Neon. Screens opt into
            // liveHot / liveWarm / liveCool polling for multi-user sync.
            staleTime: 15_000,
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
