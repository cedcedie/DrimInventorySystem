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

export type AdjustmentsFilters = { refNo?: string; product?: string; note?: string; user?: string };

/** Each filled-in field is its own AND'd condition — not one free-text box
 * OR-ing across everything. */
async function fetchStockAdjustmentsData(page: number, filters: AdjustmentsFilters = {}) {
  const { refNo, product, note, user } = filters;
  const and: object[] = [];
  if (refNo) and.push({ refNo: { contains: refNo, mode: "insensitive" as const } });
  if (note) and.push({ note: { contains: note, mode: "insensitive" as const } });
  if (user) and.push({ byUser: { name: { contains: user, mode: "insensitive" as const } } });
  if (product) {
    and.push({
      OR: [
        { product: { name: { contains: product, mode: "insensitive" as const } } },
        { product: { code: { contains: product, mode: "insensitive" as const } } },
      ],
    });
  }
  const where = and.length ? { AND: and } : {};

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

export async function getStockAdjustmentsData(params: { page?: number } & AdjustmentsFilters) {
  const page = Math.max(1, params.page ?? 1);
  const filters: AdjustmentsFilters = {
    refNo: params.refNo?.trim() || undefined,
    product: params.product?.trim() || undefined,
    note: params.note?.trim() || undefined,
    user: params.user?.trim() || undefined,
  };
  const hasFilter = Object.values(filters).some(Boolean);
  if (page === 1 && !hasFilter) return loadFirstPageAdjustments();
  return fetchStockAdjustmentsData(page, filters);
}

export type StockAdjustmentsData = Awaited<ReturnType<typeof getStockAdjustmentsData>>;
