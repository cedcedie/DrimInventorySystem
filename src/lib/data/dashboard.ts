import { prisma } from "@/lib/prisma";
import type { MrfStatus } from "@/generated/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";
import { getActivityWidgetData } from "@/lib/data/activity";

/** When `technicianId` is set, returns only that tech's open MRFs — no warehouse
 * SI/SO feeds, stock KPIs, or global activity. */
export async function getDashboardData(technicianId?: string) {
  "use cache";
  tagAndLife("dashboard", CACHE_SECONDS.dashboard);

  if (technicianId) {
    return getTechnicianDashboard(technicianId);
  }

  return getWarehouseDashboard();
}

async function getTechnicianDashboard(technicianId: string) {
  const mrfOpenStatuses: MrfStatus[] = ["PENDING", "PARTIAL"];
  const mrfOpenFilter = {
    status: { in: mrfOpenStatuses },
    technicianId,
  };

  const [pendingMrfCount, pendingMrfs, activityFeed] = await Promise.all([
    prisma.mrf.count({ where: mrfOpenFilter }),
    prisma.mrf.findMany({
      where: mrfOpenFilter,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        refNo: true,
        project: true,
        status: true,
        createdAt: true,
        technician: { select: { name: true } },
        items: { select: { qtyRequested: true, qtyFulfilled: true } },
      },
    }),
    getActivityWidgetData(),
  ]);

  return {
    kpis: {
      totalProducts: 0,
      categoryCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      pendingMrfCount,
    },
    weeklyMovement: [] as Array<{
      day: string;
      date: string;
      stockIn: number;
      stockOut: number;
    }>,
    activityFeed: activityFeed.rows,
    pendingMrfs: pendingMrfs.map((m) => {
      const requested = m.items.reduce((s, i) => s + i.qtyRequested, 0);
      const fulfilled = m.items.reduce((s, i) => s + i.qtyFulfilled, 0);
      return {
        id: m.id,
        refNo: m.refNo,
        project: m.project,
        status: m.status,
        technician: m.technician.name,
        itemCount: m.items.length,
        requested,
        fulfilled,
        dt: m.createdAt.toISOString(),
      };
    }),
    activity: [] as Array<{ dt: string; action: string; refNo: string; user: string }>,
    transactions: [] as Array<{
      dt: string;
      ref: string;
      type: "Stock-In" | "Stock-Out";
      desc: string;
      user: string;
      link: string;
    }>,
    lowAlerts: [] as Array<{
      product: string;
      category: string;
      qty: number;
      unit: string;
      supplier: string | null;
      supplierContact: string | null;
    }>,
    outAlerts: [] as Array<{
      product: string;
      category: string;
      qty: number;
      unit: string;
      supplier: string | null;
      supplierContact: string | null;
    }>,
  };
}

async function getWarehouseDashboard() {
  const mrfOpenStatuses: MrfStatus[] = ["PENDING", "PARTIAL"];
  const mrfOpenFilter = { status: { in: mrfOpenStatuses } };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

  const [
    totalProducts,
    categoryCount,
    lowStockCountRows,
    outOfStockCount,
    lowStockRows,
    outOfStockRows,
    stockIns,
    stockOuts,
    pendingMrfCount,
    pendingMrfs,
    recentActivity,
    weeklyIn,
    weeklyOut,
    activityFeed,
  ] = await Promise.all([
    prisma.product.count({ where: { archivedAt: null } }),
    prisma.category.count(),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Product" WHERE "archivedAt" IS NULL AND stocks > 0 AND stocks <= "minLevel"
    `,
    prisma.product.count({ where: { stocks: 0, archivedAt: null } }),
    prisma.$queryRaw<
      { name: string; stocks: number; unit: string; category: string; supplier: string | null; supplierContact: string | null }[]
    >`
      SELECT p.name, p.stocks, p.unit, c.name AS category, s.name AS supplier, s.contact AS "supplierContact"
      FROM "Product" p
      JOIN "Category" c ON c.id = p."categoryId"
      LEFT JOIN "Supplier" s ON s.id = p."supplierId"
      WHERE p."archivedAt" IS NULL AND p.stocks > 0 AND p.stocks <= p."minLevel"
      ORDER BY p.name ASC
      LIMIT 8
    `,
    prisma.product.findMany({
      where: { stocks: 0, archivedAt: null },
      select: {
        name: true,
        stocks: true,
        unit: true,
        category: { select: { name: true } },
        supplier: { select: { name: true, contact: true } },
      },
      orderBy: { name: "asc" },
      take: 8,
    }),
    prisma.stockIn.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        createdAt: true,
        qty: true,
        product: { select: { name: true } },
        stockInBatch: {
          select: {
            refNo: true,
            supplier: { select: { name: true } },
            byUser: { select: { name: true } },
          },
        },
      },
    }),
    prisma.stockOut.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        createdAt: true,
        refNo: true,
        qty: true,
        product: { select: { name: true } },
        byUser: { select: { name: true } },
        mrf: { select: { refNo: true, project: true } },
      },
    }),
    prisma.mrf.count({ where: mrfOpenFilter }),
    prisma.mrf.findMany({
      where: mrfOpenFilter,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        refNo: true,
        project: true,
        status: true,
        createdAt: true,
        technician: { select: { name: true } },
        items: { select: { qtyRequested: true, qtyFulfilled: true } },
      },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        createdAt: true,
        action: true,
        refNo: true,
        user: { select: { name: true } },
      },
    }),
    prisma.stockIn.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true, qty: true },
    }),
    prisma.stockOut.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true, qty: true },
    }),
    getActivityWidgetData(),
  ]);

  const lowStockCount = Number(lowStockCountRows[0]?.count ?? 0);

  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const stockInByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  const stockOutByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  for (const row of weeklyIn) {
    const k = row.createdAt.toISOString().slice(0, 10);
    if (k in stockInByDay) stockInByDay[k] += row.qty;
  }
  for (const row of weeklyOut) {
    const k = row.createdAt.toISOString().slice(0, 10);
    if (k in stockOutByDay) stockOutByDay[k] += row.qty;
  }

  const weeklyMovement = dayKeys.map((k) => {
    const d = new Date(k + "T12:00:00");
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: k,
      stockIn: stockInByDay[k],
      stockOut: stockOutByDay[k],
    };
  });

  const transactions = [
    ...stockIns.map((si) => ({
      dt: si.createdAt.toISOString(),
      ref: si.stockInBatch.refNo,
      type: "Stock-In" as const,
      desc: `Received ${si.qty} × ${si.product.name} from ${si.stockInBatch.supplier.name}`,
      user: si.stockInBatch.byUser.name,
      link: `Slip# ${si.stockInBatch.refNo}`,
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
      lowStockCount,
      outOfStockCount,
      pendingMrfCount,
    },
    weeklyMovement,
    pendingMrfs: pendingMrfs.map((m) => {
      const requested = m.items.reduce((s, i) => s + i.qtyRequested, 0);
      const fulfilled = m.items.reduce((s, i) => s + i.qtyFulfilled, 0);
      return {
        id: m.id,
        refNo: m.refNo,
        project: m.project,
        status: m.status,
        technician: m.technician.name,
        itemCount: m.items.length,
        requested,
        fulfilled,
        dt: m.createdAt.toISOString(),
      };
    }),
    activity: recentActivity.map((a) => ({
      dt: a.createdAt.toISOString(),
      action: a.action,
      refNo: a.refNo,
      user: a.user.name,
    })),
    activityFeed: activityFeed.rows,
    transactions,
    lowAlerts: lowStockRows.map((p) => ({
      product: p.name,
      category: p.category,
      qty: p.stocks,
      unit: p.unit,
      supplier: p.supplier,
      supplierContact: p.supplierContact,
    })),
    outAlerts: outOfStockRows.map((p) => ({
      product: p.name,
      category: p.category.name,
      qty: 0,
      unit: p.unit,
      supplier: p.supplier?.name ?? null,
      supplierContact: p.supplier?.contact ?? null,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
