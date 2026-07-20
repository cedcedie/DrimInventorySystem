import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 15;

async function fetchActivityData(page: number) {
  const [total, activities] = await Promise.all([
    prisma.activityLog.count(),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: true },
    }),
  ]);

  return {
    rows: activities.map((a) => ({
      dt: a.createdAt.toISOString(),
      user: a.user.name,
      role: a.user.role,
      action: a.action,
      ref: a.refNo,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

// Only page 1 is used for the page's server-rendered initial load; later
// pages are fetched client-side via /api/activity directly.
const getCachedFirstPageActivityData = unstable_cache(
  () => fetchActivityData(1),
  ["activity-data-page-1"],
  { revalidate: 15, tags: ["activity"] }
);

export async function getActivityData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return getCachedFirstPageActivityData();
  return fetchActivityData(page);
}

export type ActivityData = Awaited<ReturnType<typeof getActivityData>>;
