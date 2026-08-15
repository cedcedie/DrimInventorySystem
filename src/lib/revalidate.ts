import { revalidateTag } from "next/cache";

export type CacheTag =
  | "dashboard"
  | "inventory"
  | "products"
  | "suppliers"
  | "technicians"
  | "users"
  | "activity"
  | "stock-in"
  | "stock-out"
  | "mrf"
  | "adjustments"
  | "settings"
  | "permissions"
  | "purchase-orders"
  | "purchase-requests";

/** Every mutation writes an ActivityLog row, so "activity" (the shared
 * activity log, role-filtered — see getActivityData) and "dashboard"
 * (recent transactions + activity widget) are revalidated alongside
 * whichever module's own data changed. Extra dynamic tags (e.g. a
 * per-technician MRF cache key) can be passed via extraTags. */
export function revalidateAfterMutation(tags: CacheTag[], extraTags: string[] = []) {
  const unique = new Set<string>([...tags, ...extraTags, "activity", "dashboard"]);
  for (const tag of unique) revalidateTag(tag);
}

/** Permission toggles should not bust dashboard/activity — only the matrix. */
export function revalidatePermissions() {
  revalidateTag("permissions");
}
