import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

async function fetchUsersData(page: number) {
  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  return {
    rows: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status,
      avatarKey: u.avatarKey,
      recentActivity: u.activities[0]
        ? `${u.activities[0].action} · ${u.activities[0].refNo}`
        : "No recorded activity",
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

async function loadFirstPageUsers() {
  "use cache";
  tagAndLife("users", CACHE_SECONDS.list);
  return fetchUsersData(1);
}

export async function getUsersData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return loadFirstPageUsers();
  return fetchUsersData(page);
}

export type UsersData = Awaited<ReturnType<typeof getUsersData>>;
