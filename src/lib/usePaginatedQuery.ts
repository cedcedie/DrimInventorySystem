"use client";

import { useState } from "react";
import { useQuery, keepPreviousData, type QueryKey } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";

/** Every paginated screen (Products, Suppliers, MRF, …) repeats the same
 * page-state + useQuery shape — this is that shape, factored out once.
 * `initialData` only seeds page 1 (server-rendered first page); any other
 * starting page fetches fresh, same as before this was extracted.
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

  const query = useQuery({
    queryKey: opts.queryKey(page),
    queryFn: () => fetchJson<T>(opts.url(page)),
    initialData: page === 1 ? opts.initialData : undefined,
    placeholderData: keepPreviousData,
    ...opts.live,
  });

  return { ...query, page, setPage };
}
