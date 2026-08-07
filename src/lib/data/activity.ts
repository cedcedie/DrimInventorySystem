import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

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

async function loadFirstPageActivity() {
  "use cache";
  tagAndLife("activity", CACHE_SECONDS.short);
  return fetchActivityData(1);
}

export async function getActivityData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return loadFirstPageActivity();
  return fetchActivityData(page);
}

export type ActivityData = Awaited<ReturnType<typeof getActivityData>>;
