/** Tiered live-sync via client polling (not WebSockets); pauses when the tab is hidden. */

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

/** Open MRFs, tech requests, open fulfill modals — only worth polling while the tab is visible. */
export const liveHot = {
  staleTime: 6_000,
  refetchInterval: () => whenVisible(10_000),
  ...focusReconnect,
};

/** Keeps polling even while backgrounded, unlike liveHot, so alerts land within ~10s not just on focus. */
export const liveNotifications = {
  staleTime: 6_000,
  refetchInterval: 10_000,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
};

/** Dashboard + SI/SO ledgers — less urgent than the queue. */
export const liveWarm = {
  staleTime: 12_000,
  refetchInterval: () => whenVisible(20_000),
  ...focusReconnect,
};

/** Catalog / history screens — focus refresh covers most cases. */
export const liveCool = {
  staleTime: 25_000,
  refetchInterval: () => whenVisible(45_000),
  ...focusReconnect,
};

