import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";

/** Shared TTL presets for `"use cache"` data functions. */
export const CACHE_SECONDS = {
  /** Sidebar badges, form options */
  short: 15,
  /** List pages (products, inventory, stock, …) */
  list: 20,
  /** Dashboard aggregates */
  dashboard: 60,
  /** Rarely changing company settings */
  settings: 300,
  /** Permission matrix — short so edits feel quick even if tag miss */
  permissions: 30,
} as const;

export function tagAndLife(tag: string | string[], seconds: number) {
  const tags = Array.isArray(tag) ? tag : [tag];
  for (const t of tags) cacheTag(t);
  cacheLife({ revalidate: seconds });
}
