import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";
import type { Role } from "@/generated/prisma";

const PAGE_SIZE = 15;
const WIDGET_SIZE = 10;

function isPrivileged(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

export type ActivityFilters = { user?: string; action?: string; ref?: string };

/** One table, one page, filtered by who's asking — Owner/Admin see every row
 * (including sensitive account/permission/config changes); everyone else sees
 * operational events only. Each filled-in field is its own AND'd condition —
 * not one free-text box OR-ing across everything. */
async function fetchActivityData(
  page: number,
  includeSensitive: boolean,
  filters: ActivityFilters = {},
  take = PAGE_SIZE
) {
  const { user, action, ref } = filters;
  const and: object[] = [includeSensitive ? {} : { sensitive: false }];
  if (user) and.push({ user: { name: { contains: user, mode: "insensitive" as const } } });
  if (action) and.push({ action: { contains: action, mode: "insensitive" as const } });
  if (ref) and.push({ refNo: { contains: ref, mode: "insensitive" as const } });

  const where = { AND: and };

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

export async function getActivityData(params: { page?: number; role: Role } & ActivityFilters) {
  const page = Math.max(1, params.page ?? 1);
  const filters: ActivityFilters = {
    user: params.user?.trim() || undefined,
    action: params.action?.trim() || undefined,
    ref: params.ref?.trim() || undefined,
  };
  const hasFilter = Object.values(filters).some(Boolean);
  if (page === 1 && !hasFilter) return loadFirstPageActivity(params.role);
  return fetchActivityData(page, isPrivileged(params.role), filters);
}

async function loadActivityWidget() {
  "use cache";
  tagAndLife("activity", CACHE_SECONDS.dashboard);
  // Always filtered/non-sensitive, regardless of viewer role — this is a preview, not the audit surface.
  return fetchActivityData(1, false, {}, WIDGET_SIZE);
}

/** Compact last-10 rows for the Dashboard widget, non-sensitive view for every role. */
export async function getActivityWidgetData() {
  return loadActivityWidget();
}

export type ActivityData = Awaited<ReturnType<typeof getActivityData>>;
