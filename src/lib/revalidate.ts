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

/** Every mutation writes an ActivityLog row, so "activity" and "dashboard" are revalidated
 * alongside whichever module's own data changed. */
export function revalidateAfterMutation(tags: CacheTag[], extraTags: string[] = []) {
  const unique = new Set<string>([...tags, ...extraTags, "activity", "dashboard"]);
  for (const tag of unique) revalidateTag(tag);
}

/** Permission toggles don't bust dashboard/activity, only the matrix. */
export function revalidatePermissions() {
  revalidateTag("permissions");
}
