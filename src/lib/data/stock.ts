import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

/** Lets the same search box match a date, e.g. "Jul 30" or "2026-07-30" —
 * matches the calendar day only (server-local), not an exact timestamp.
 * Only attempted when `q` has a digit (a bare word like "Copper" should
 * never accidentally parse as a date). Returns null when `q` isn't a date. */
function tryParseDateRange(q: string): { gte: Date; lt: Date } | null {
  if (!/\d/.test(q)) return null;
  const parsed = new Date(q);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

async function fetchStockInData(page: number) {
  // Paginate on batches, then flatten to one row per item (table shows one row per product).
  const [total, batches] = await Promise.all([
    prisma.stockInBatch.count(),
    prisma.stockInBatch.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { supplier: true, items: { include: { product: true } } },
    }),
  ]);

  return {
    rows: batches.flatMap((batch) =>
      batch.items.map((item) => ({
        id: item.id,
        ref: batch.refNo,
        date: batch.createdAt.toISOString(),
        supplier: batch.supplier.name,
        item: item.product.name,
        qty: item.qty,
        productId: item.productId,
        productCode: item.product.code,
        productUnit: item.product.unit,
        productStocks: item.product.stocks,
      }))
    ),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

async function loadFirstPageStockIn() {
  "use cache";
  tagAndLife("stock-in", CACHE_SECONDS.short);
  return fetchStockInData(1);
}

export async function getStockInData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return loadFirstPageStockIn();
  return fetchStockInData(page);
}

export type StockInData = Awaited<ReturnType<typeof getStockInData>>;

async function fetchStockOutData(page: number, q = "") {
  // Matches item name/code, the requesting technician, the MRF's project,
  // the MRF number, or the release date — not just the product, so "who
  // asked for this" or "which project" or "what shipped on the 30th" all
  // find the same release history as searching the item would.
  const dateRange = tryParseDateRange(q);
  const where = q
    ? {
        OR: [
          { product: { name: { contains: q, mode: "insensitive" as const } } },
          { product: { code: { contains: q, mode: "insensitive" as const } } },
          { technician: { name: { contains: q, mode: "insensitive" as const } } },
          { mrf: { project: { contains: q, mode: "insensitive" as const } } },
          { mrf: { refNo: { contains: q, mode: "insensitive" as const } } },
          ...(dateRange ? [{ createdAt: dateRange }] : []),
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.stockOut.count({ where }),
    prisma.stockOut.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: true, technician: true, mrf: true },
    }),
  ]);

  return {
    rows: rows.map((so) => ({
      id: so.id,
      ref: so.refNo,
      date: so.createdAt.toISOString(),
      tech: so.technician.name,
      item: so.product.name,
      qty: so.qty,
      mrf: so.mrf?.refNo ?? "—",
      project: so.mrf?.project ?? "—",
      empNo: so.technician.empNo,
      position: so.technician.position,
      productId: so.productId,
      productCode: so.product.code,
      productUnit: so.product.unit,
      productStocks: so.product.stocks,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

async function loadFirstPageStockOut() {
  "use cache";
  tagAndLife("stock-out", CACHE_SECONDS.short);
  return fetchStockOutData(1);
}

export async function getStockOutData(params: { page?: number; q?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  if (page === 1 && !q) return loadFirstPageStockOut();
  return fetchStockOutData(page, q);
}

export type StockOutData = Awaited<ReturnType<typeof getStockOutData>>;

async function loadStockFormOptions() {
  "use cache";
  tagAndLife(["stock-in", "stock-out", "mrf", "technicians", "products"], CACHE_SECONDS.short);

  const [products, suppliers, technicians, pendingMrfs] = await Promise.all([
    prisma.product.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        stocks: true,
        unit: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.technician.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, empNo: true },
    }),
    prisma.mrf.findMany({
      where: {
        OR: [{ status: "PENDING" }, { status: "PARTIAL" }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          where: {
            qtyFulfilled: {
              lt: prisma.mrfItem.fields.qtyRequested,
            },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                stocks: true,
                unit: true,
              },
            },
          },
        },
        technician: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    products,
    suppliers,
    technicians,
    pendingMrfItems: pendingMrfs.flatMap((mrf) =>
      mrf.items.map((item) => ({
        id: item.id,
        mrfId: mrf.id,
        mrfRefNo: mrf.refNo,
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.code,
        qtyRequested: item.qtyRequested,
        qtyFulfilled: item.qtyFulfilled,
        qtyRemaining: item.qtyRequested - item.qtyFulfilled,
        availableStock: item.product.stocks,
        unit: item.product.unit,
        project: mrf.project,
        technicianName: mrf.technician.name,
      }))
    ),
  };
}

export async function getStockFormOptions() {
  return loadStockFormOptions();
}

export type StockFormOptions = Awaited<ReturnType<typeof getStockFormOptions>>;

/** For technicians filing MRFs — no warehouse queue / SI options. */
async function loadMrfFilingProducts(): Promise<StockFormOptions> {
  "use cache";
  tagAndLife(["products", "mrf"], CACHE_SECONDS.short);

  const products = await prisma.product.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      stocks: true,
      unit: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });

  return {
    products,
    suppliers: [],
    technicians: [],
    pendingMrfItems: [],
  };
}

export async function getMrfFilingProductOptions() {
  return loadMrfFilingProducts();
}

/** Products this technician has most recently requested — feeds the "Recent"
 * shortcut above the full search list in the MRF filing picker. Not cached:
 * changes with every MRF filed, and it's a small, cheap per-user query. */
export async function getRecentMrfProducts(technicianId: string, limit = 5) {
  const recentItems = await prisma.mrfItem.findMany({
    where: { mrf: { technicianId } },
    orderBy: { mrf: { createdAt: "desc" } },
    take: limit * 3, // over-fetch since the same product can repeat across MRFs
    select: {
      product: {
        select: { id: true, name: true, code: true, stocks: true, unit: true, categoryId: true },
      },
    },
  });

  const seen = new Set<string>();
  const recent = [];
  for (const { product } of recentItems) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    recent.push(product);
    if (recent.length >= limit) break;
  }
  return recent;
}
