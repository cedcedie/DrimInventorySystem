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
  | "settings";

/** Every mutation writes an ActivityLog row, so "activity" + "dashboard"
 * (recent transactions feed) are revalidated alongside whichever module's
 * own data changed. Extra dynamic tags (e.g. a per-technician MRF cache key)
 * can be passed via extraTags. */
export function revalidateAfterMutation(tags: CacheTag[], extraTags: string[] = []) {
  const unique = new Set<string>([...tags, ...extraTags, "activity", "dashboard"]);
  for (const tag of unique) revalidateTag(tag);
}
