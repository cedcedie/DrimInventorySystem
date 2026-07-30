import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Mutations call revalidateTag("dashboard"), so a short revalidate window buys
// nothing but extra load — stale data is already invalidated on write.
export const getDashboardData = unstable_cache(
  async () => fetchDashboardData(),
  ["dashboard-data"],
  { revalidate: 60, tags: ["dashboard"] }
);

async function fetchDashboardData() {
  const [
    totalProducts,
    categoryCount,
    totalValueRows,
    lowStockCountRows,
    outOfStockCount,
    lowStockRows,
    outOfStockRows,
    stockIns,
    stockOuts,
    pendingMrfCount,
    recentActivity,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({ distinct: ["categoryId"], select: { categoryId: true } }).then((r) => r.length),
    // Prisma can't sum a computed column (amount * stocks) via aggregate — read-only, no user input.
    prisma.$queryRaw<{ total: number | null }[]>`
      SELECT SUM(amount * stocks)::float8 AS total FROM "Product"
    `,
    // Prisma can't compare two columns (stocks <= "minLevel") in a where clause without raw SQL.
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Product" WHERE stocks > 0 AND stocks <= "minLevel"
    `,
    prisma.product.count({ where: { stocks: 0 } }),
    prisma.$queryRaw<
      { name: string; stocks: number; unit: string; category: string }[]
    >`
      SELECT p.name, p.stocks, p.unit, c.name AS category
      FROM "Product" p
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE p.stocks > 0 AND p.stocks <= p."minLevel"
      ORDER BY p.name ASC
      LIMIT 20
    `,
    prisma.product.findMany({
      where: { stocks: 0 },
      select: { name: true, stocks: true, unit: true, category: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 20,
    }),
    prisma.stockIn.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { product: true, supplier: true, byUser: true },
    }),
    prisma.stockOut.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { product: true, technician: true, byUser: true, mrf: true },
    }),
    // Uses the @@index([status]) added in Task 2.
    prisma.mrf.count({ where: { status: "PENDING" } }),
    // Uses the @@index([userId, createdAt]) — bounded to the 8 most recent.
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const totalValue = totalValueRows[0]?.total ?? 0;
  const lowStockCount = Number(lowStockCountRows[0]?.count ?? 0);

  const transactions = [
    ...stockIns.map((si) => ({
      dt: si.createdAt.toISOString(),
      ref: si.refNo,
      type: "Stock-In" as const,
      desc: `Received ${si.qty} × ${si.product.name} from ${si.supplier.name}`,
      user: si.byUser.name,
      link: `Slip# ${si.refNo}`,
    })),
    ...stockOuts.map((so) => ({
      dt: so.createdAt.toISOString(),
      ref: so.refNo,
      type: "Stock-Out" as const,
      desc: `Released ${so.qty} × ${so.product.name}${so.mrf ? ` — ${so.mrf.project}` : ""}`,
      user: so.byUser.name,
      link: so.mrf ? so.mrf.refNo : `Slip# ${so.refNo}`,
    })),
  ]
    .sort((a, b) => new Date(b.dt).getTime() - new Date(a.dt).getTime())
    .slice(0, 8);

  return {
    kpis: {
      totalProducts,
      categoryCount,
      totalValue,
      lowStockCount,
      outOfStockCount,
      pendingMrfCount,
    },
    activity: recentActivity.map((a) => ({
      dt: a.createdAt.toISOString(),
      action: a.action,
      refNo: a.refNo,
      user: a.user.name,
    })),
    transactions,
    lowAlerts: lowStockRows.map((p) => ({
      product: p.name,
      category: p.category,
      qty: p.stocks,
      unit: p.unit,
    })),
    outAlerts: outOfStockRows.map((p) => ({
      product: p.name,
      category: p.category.name,
      qty: 0,
      unit: p.unit,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
