import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";

/** Shared TTL presets for `"use cache"` data functions.
 * Keep these under the client LIVE_POLL_MS (~12s) so polls aren't blocked by stale server cache
 * when another user's mutation tag revalidation is slightly delayed. */
export const CACHE_SECONDS = {
  /** Sidebar badges, form options */
  short: 5,
  /** List pages (products, inventory, stock, …) */
  list: 8,
  /** Dashboard aggregates */
  dashboard: 10,
  /** Rarely changing company settings */
  settings: 300,
  /** Permission matrix — short so edits feel quick even if tag miss */
  permissions: 15,
} as const;

export function tagAndLife(tag: string | string[], seconds: number) {
  const tags = Array.isArray(tag) ? tag : [tag];
  for (const t of tags) cacheTag(t);
  cacheLife({ revalidate: seconds });
}
