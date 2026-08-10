/** Shared React Query options so multi-user ops stay near-live without a full page refresh.
 * Polling hits Neon via API routes; server `"use cache"` TTLs stay shorter than the poll. */
export const LIVE_POLL_MS = 12_000;

export const liveQueryOptions = {
  staleTime: 4_000,
  refetchInterval: LIVE_POLL_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;
