import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 20;
const WIDGET_SIZE = 10;

/** The system-wide feed every logged-in user can see — operational events
 * only (stock, MRF, purchase orders, catalog changes). Account/permission/
 * company-config changes are marked `sensitive` and excluded here; they
 * still appear in full on the existing Owner/Admin-only Activity Log
 * (getActivityData), which stays unfiltered. */
async function fetchActivityFeed(page: number, take: number) {
  const [total, rows] = await Promise.all([
    prisma.activityLog.count({ where: { sensitive: false } }),
    prisma.activityLog.findMany({
      where: { sensitive: false },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { user: { select: { name: true, role: true } } },
    }),
  ]);

  return {
    rows: rows.map((a) => ({
      id: a.id,
      dt: a.createdAt.toISOString(),
      user: a.user.name,
      role: a.user.role,
      action: a.action,
      ref: a.refNo,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / take)),
    total,
  };
}

async function loadFirstPageFeed() {
  "use cache";
  tagAndLife(["activity", "activity-feed"], CACHE_SECONDS.short);
  return fetchActivityFeed(1, PAGE_SIZE);
}

/** Paginated feed for the full Activity Feed page. */
export async function getActivityFeedData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return loadFirstPageFeed();
  return fetchActivityFeed(page, PAGE_SIZE);
}

async function loadFeedWidget() {
  "use cache";
  tagAndLife(["activity", "activity-feed"], CACHE_SECONDS.dashboard);
  return fetchActivityFeed(1, WIDGET_SIZE);
}

/** Compact last-10 feed for the Dashboard widget. */
export async function getActivityFeedWidgetData() {
  return loadFeedWidget();
}

export type ActivityFeedData = Awaited<ReturnType<typeof getActivityFeedData>>;
