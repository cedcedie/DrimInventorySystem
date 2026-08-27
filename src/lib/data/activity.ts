import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";
import type { Role } from "@/generated/prisma";

const PAGE_SIZE = 15;
const WIDGET_SIZE = 10;

function isPrivileged(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

/** One table, one page, filtered by who's asking — Owner/Admin see every row
 * (including sensitive account/permission/config changes); everyone else sees
 * operational events only. */
async function fetchActivityData(
  page: number,
  includeSensitive: boolean,
  q = "",
  take = PAGE_SIZE
) {
  const where = {
    AND: [
      includeSensitive ? {} : { sensitive: false },
      q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" as const } },
              { refNo: { contains: q, mode: "insensitive" as const } },
              { user: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {},
    ],
  };

  const [total, activities] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { user: { select: { name: true, role: true, avatarKey: true } } },
    }),
  ]);

  return {
    rows: activities.map((a) => ({
      id: a.id,
      dt: a.createdAt.toISOString(),
      user: a.user.name,
      role: a.user.role,
      avatarKey: a.user.avatarKey,
      action: a.action,
      ref: a.refNo,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / take)),
    total,
  };
}

async function loadFirstPageActivity(role: Role) {
  "use cache";
  tagAndLife("activity", CACHE_SECONDS.short);
  return fetchActivityData(1, isPrivileged(role));
}

export async function getActivityData(params: { page?: number; role: Role; q?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  if (page === 1 && !q) return loadFirstPageActivity(params.role);
  return fetchActivityData(page, isPrivileged(params.role), q);
}

async function loadActivityWidget() {
  "use cache";
  tagAndLife("activity", CACHE_SECONDS.dashboard);
  // Always filtered/non-sensitive, regardless of viewer role — this is a preview, not the audit surface.
  return fetchActivityData(1, false, "", WIDGET_SIZE);
}

/** Compact last-10 rows for the Dashboard widget, non-sensitive view for every role. */
export async function getActivityWidgetData() {
  return loadActivityWidget();
}

export type ActivityData = Awaited<ReturnType<typeof getActivityData>>;
