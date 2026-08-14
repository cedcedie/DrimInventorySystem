import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getActivityFeedData } from "@/lib/data/activityFeed";

/** System-wide operational feed — every role has "activity-feed" in
 * MODULE_ACCESS (see rbac.ts), so this is effectively "any logged-in user."
 * Scoped only by excluding sensitive (account/permission/settings) rows at
 * the data layer, not by role. The existing /api/activity (full unfiltered
 * audit log) stays Owner/Admin-only, unchanged. */
export async function GET(req: Request) {
  const auth = await requireModuleAccess("activity-feed");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getActivityFeedData({ page: Number(searchParams.get("page") ?? "1") });

  return NextResponse.json(data);
}
