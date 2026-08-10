/**
 * Tiered live-sync for multi-user Vercel + Neon.
 * Same architecture (client poll → API → DB / short server cache) — not WebSockets.
 * Polls pause when the browser tab is hidden to save Neon + serverless load.
 */

function whenVisible(ms: number): number | false {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return false;
  }
  return ms;
}

const focusReconnect = {
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;

/** Open MRFs, tech requests, notifications, open fulfill modals — must feel current. */
export const liveHot = {
  staleTime: 6_000,
  refetchInterval: () => whenVisible(10_000),
  ...focusReconnect,
};

/** Dashboard + SI/SO ledgers — useful live, less urgent than the queue. */
export const liveWarm = {
  staleTime: 12_000,
  refetchInterval: () => whenVisible(20_000),
  ...focusReconnect,
};

/** Catalog / history screens — change less often; focus refresh covers most cases. */
export const liveCool = {
  staleTime: 25_000,
  refetchInterval: () => whenVisible(45_000),
  ...focusReconnect,
};

/** @deprecated Prefer liveHot / liveWarm / liveCool — kept as hot alias. */
export const liveQueryOptions = liveHot;

export const LIVE_POLL_MS = 10_000;
