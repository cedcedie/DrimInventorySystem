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

  const query = useQuery({
    queryKey: opts.queryKey(page),
    queryFn: () => fetchJson<T>(opts.url(page)),
    initialData: seedDataRef.current,
    placeholderData: keepPreviousData,
    ...opts.live,
  });

  return { ...query, page, setPage };
}
