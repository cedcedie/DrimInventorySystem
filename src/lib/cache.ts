import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";

/** Shared TTL presets for `"use cache"` data functions.
 * Tuned so concurrent users share cache hits, while still refreshing before
 * the matching client poll tier (hot ~10s / warm ~20s / cool ~45s). */
export const CACHE_SECONDS = {
  /** Sidebar badges, form options, open MRF queue */
  short: 8,
  /** Catalog / inventory / adjustments lists (cool tier) */
  list: 20,
  /** Dashboard aggregates (warm tier) */
  dashboard: 15,
  /** Rarely changing company settings */
  settings: 300,
  /** Permission matrix */
  permissions: 20,
} as const;

export function tagAndLife(tag: string | string[], seconds: number) {
  const tags = Array.isArray(tag) ? tag : [tag];
  for (const t of tags) cacheTag(t);
  cacheLife({ revalidate: seconds });
}
