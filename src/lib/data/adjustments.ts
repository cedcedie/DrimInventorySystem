import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

export const REASON_LABELS: Record<string, string> = {
  MISCOUNT: "Miscount",
  DAMAGED: "Damaged",
  LOST: "Lost",
  FOUND: "Found",
  RETURN: "Returned unused",
  CORRECTION: "Data correction",
};

async function fetchStockAdjustmentsData(page: number, q = "") {
  // Matches the product, the adjustment slip #, who made the correction, or
  // its note — not just the product.
  const where = q
    ? {
        OR: [
          { refNo: { contains: q, mode: "insensitive" as const } },
          { note: { contains: q, mode: "insensitive" as const } },
          { byUser: { name: { contains: q, mode: "insensitive" as const } } },
          { product: { name: { contains: q, mode: "insensitive" as const } } },
          { product: { code: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.stockAdjustment.count({ where }),
    prisma.stockAdjustment.findMany({
      where,
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

async function loadFirstPageAdjustments() {
  "use cache";
  tagAndLife("adjustments", CACHE_SECONDS.dashboard);
  return fetchStockAdjustmentsData(1);
}

export async function getStockAdjustmentsData(params: { page?: number; q?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  if (page === 1 && !q) return loadFirstPageAdjustments();
  return fetchStockAdjustmentsData(page, q);
}

export type StockAdjustmentsData = Awaited<ReturnType<typeof getStockAdjustmentsData>>;
