import { revalidateTag } from "next/cache";

export type CacheTag =
  | "dashboard"
  | "inventory"
  | "products"
  | "suppliers"
  | "technicians"
  | "users"
  | "activity"
  | "activity-feed"
  | "stock-in"
  | "stock-out"
  | "mrf"
  | "adjustments"
  | "settings"
  | "permissions"
  | "purchase-orders";

/** Every mutation writes an ActivityLog row, so "activity" (full audit log),
 * "activity-feed" (system-wide feed), and "dashboard" (recent transactions +
 * feed widget) are revalidated alongside whichever module's own data
 * changed. Extra dynamic tags (e.g. a per-technician MRF cache key) can be
 * passed via extraTags. */
export function revalidateAfterMutation(tags: CacheTag[], extraTags: string[] = []) {
  const unique = new Set<string>([...tags, ...extraTags, "activity", "activity-feed", "dashboard"]);
  for (const tag of unique) revalidateTag(tag);
}

/** Permission toggles should not bust dashboard/activity — only the matrix. */
export function revalidatePermissions() {
  revalidateTag("permissions");
}
