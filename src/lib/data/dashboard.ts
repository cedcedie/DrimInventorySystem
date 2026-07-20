import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const getDashboardData = unstable_cache(
  async () => fetchDashboardData(),
  ["dashboard-data"],
  { revalidate: 20, tags: ["dashboard"] }
);

async function fetchDashboardData() {
  const [products, stockIns, stockOuts] = await Promise.all([
    prisma.product.findMany({
      select: { name: true, stocks: true, minLevel: true, unit: true, amount: true, category: { select: { name: true } } },
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
  ]);

  const totalProducts = products.length;
  const lowStockList = products.filter((p) => p.stocks > 0 && p.stocks <= p.minLevel);
  const outOfStockList = products.filter((p) => p.stocks === 0);
  const totalValue = products.reduce((acc, p) => acc + Number(p.amount) * p.stocks, 0);
  const categoryCount = new Set(products.map((p) => p.category.name)).size;

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
      lowStockCount: lowStockList.length,
      outOfStockCount: outOfStockList.length,
    },
    transactions,
    lowAlerts: lowStockList.map((p) => ({
      product: p.name,
      category: p.category.name,
      qty: p.stocks,
      unit: p.unit,
    })),
    outAlerts: outOfStockList.map((p) => ({
      product: p.name,
      category: p.category.name,
      qty: 0,
      unit: p.unit,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
