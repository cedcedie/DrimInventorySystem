import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 15;

export const REASON_LABELS: Record<string, string> = {
  MISCOUNT: "Miscount",
  DAMAGED: "Damaged",
  LOST: "Lost",
  FOUND: "Found",
  RETURN: "Returned unused",
  CORRECTION: "Data correction",
};

async function fetchStockAdjustmentsData(page: number) {
  const [total, rows] = await Promise.all([
    prisma.stockAdjustment.count(),
    prisma.stockAdjustment.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        product: { select: { name: true, code: true, unit: true } },
        byUser: { select: { name: true } },
      },
    }),
  ]);

  return {
    rows: rows.map((a) => ({
      id: a.id,
      refNo: a.refNo,
      dt: a.createdAt.toISOString(),
      product: a.product.name,
      code: a.product.code,
      unit: a.product.unit,
      qtyBefore: a.qtyBefore,
      qtyAfter: a.qtyAfter,
      delta: a.delta,
      reason: REASON_LABELS[a.reason] ?? a.reason,
      note: a.note,
      user: a.byUser.name,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

const getCachedFirstPage = unstable_cache(
  () => fetchStockAdjustmentsData(1),
  ["stock-adjustments-page-1"],
  { revalidate: 60, tags: ["adjustments"] }
);

export async function getStockAdjustmentsData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return getCachedFirstPage();
  return fetchStockAdjustmentsData(page);
}

export type StockAdjustmentsData = Awaited<ReturnType<typeof getStockAdjustmentsData>>;
