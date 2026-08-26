"use client";

import { useRef, useState } from "react";
import { useQuery, keepPreviousData, type QueryKey } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";

/** Every paginated screen (Products, Suppliers, MRF, …) repeats the same
 * page-state + useQuery shape — this is that shape, factored out once.
 *
 * `queryKey` takes `page` itself (not a pre-built key) so the cache key
 * actually changes as the caller pages through — a key built once at call
 * time would go stale and every page would hit the same cache entry. */
export function usePaginatedQuery<T>(opts: {
  queryKey: (page: number) => QueryKey;
  url: (page: number) => string;
  initialData?: T;
  /** Spread from liveHot/liveWarm/liveCool (src/lib/liveQuery.ts) for polling; omit for static lists. */
  live?: object;
}) {
  const [page, setPage] = useState(1);
  // Captured once at mount, never reassigned — checking `page === 1` on every
  // render instead breaks any caller with extra filter state (e.g. a search
  // box) that also resets page to 1: React Query treats initialData as
  // already-fresh and never refetches, so every "back to page 1" (including
  // a new search term) silently served the original unfiltered snapshot
  // back forever.
  const seedDataRef = useRef(opts.initialData);
  // The seed data only matches the *exact* key it was server-rendered for
  // (page 1 with whatever filters were in effect at mount, usually none).
  // React Query seeds whatever key it's handed `initialData` for — so handing
  // it unconditionally on every render means a caller with extra filter state
  // (Products/Inventory's search box) gets its *new* key (e.g. page 1 + a
  // search term) pre-seeded with the old unfiltered snapshot too, marked
  // fresh, and never actually fetched until staleTime elapses. Only apply it
  // when the current key still matches the one it was seeded for.
  const seedKeyRef = useRef(JSON.stringify(opts.queryKey(page)));
  const currentKey = opts.queryKey(page);
  const isSeedKey = JSON.stringify(currentKey) === seedKeyRef.current;

  const query = useQuery({
    queryKey: currentKey,
    queryFn: () => fetchJson<T>(opts.url(page)),
    initialData: isSeedKey ? seedDataRef.current : undefined,
    placeholderData: keepPreviousData,
    ...opts.live,
  });

  return { ...query, page, setPage };
}
