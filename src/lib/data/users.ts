import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

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
      recentActivity: u.activities[0]
        ? `${u.activities[0].action} · ${u.activities[0].refNo}`
        : "No recorded activity",
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

// Only page 1 is used for the page's server-rendered initial load; later
// pages are fetched client-side via /api/users directly.
const getCachedFirstPageUsersData = unstable_cache(
  () => fetchUsersData(1),
  ["users-data-page-1"],
  { revalidate: 20, tags: ["users"] }
);

export async function getUsersData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return getCachedFirstPageUsersData();
  return fetchUsersData(page);
}

export type UsersData = Awaited<ReturnType<typeof getUsersData>>;
