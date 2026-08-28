import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";
import { formatDateForExport } from "@/lib/quickExport";

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

export type StockInFilters = { item?: string; supplier?: string; refNo?: string; date?: string; receivedBy?: string };

/** Each filled-in field is its own AND'd condition — not one free-text box
 * OR-ing across everything. Filling "Item" + "Supplier" narrows to rows
 * matching BOTH, not either. Shared by the paginated list and the export route,
 * so both apply exactly the same rows. */
function buildStockInWhere(filters: StockInFilters = {}) {
  const { item, supplier, refNo, date, receivedBy } = filters;
  const dateRange = date ? tryParseDateRange(date) : null;

  const and: object[] = [];
  if (refNo) and.push({ refNo: { contains: refNo, mode: "insensitive" as const } });
  if (supplier) and.push({ supplier: { name: { contains: supplier, mode: "insensitive" as const } } });
  if (receivedBy) and.push({ byUser: { name: { contains: receivedBy, mode: "insensitive" as const } } });
  if (item) {
    and.push({
      items: {
        some: {
          product: {
            OR: [
              { name: { contains: item, mode: "insensitive" as const } },
              { code: { contains: item, mode: "insensitive" as const } },
            ],
          },
        },
      },
    });
  }
  if (dateRange) and.push({ createdAt: dateRange });

  return and.length ? { AND: and } : {};
}

async function fetchStockInData(page: number, filters: StockInFilters = {}) {
  const where = buildStockInWhere(filters);

  const [total, batches] = await Promise.all([
    prisma.stockInBatch.count({ where }),
    prisma.stockInBatch.findMany({
      where,
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

export async function getStockInData(params: { page?: number } & StockInFilters) {
  const page = Math.max(1, params.page ?? 1);
  const filters: StockInFilters = {
    item: params.item?.trim() || undefined,
    supplier: params.supplier?.trim() || undefined,
    refNo: params.refNo?.trim() || undefined,
    date: params.date?.trim() || undefined,
    receivedBy: params.receivedBy?.trim() || undefined,
  };
  const hasFilter = Object.values(filters).some(Boolean);
  if (page === 1 && !hasFilter) return loadFirstPageStockIn();
  return fetchStockInData(page, filters);
}

export type StockInData = Awaited<ReturnType<typeof getStockInData>>;

const EXPORT_CAP = 2000;

/** Same filters as the paginated list, but every matching row (capped) —
 * feeds the screen's "download what I'm looking at" export button. */
export async function getStockInExportRows(filters: StockInFilters) {
  const where = buildStockInWhere(filters);
  const [totalBatches, batches] = await Promise.all([
    prisma.stockInBatch.count({ where }),
    prisma.stockInBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_CAP,
      include: { supplier: true, byUser: true, items: { include: { product: true } } },
    }),
  ]);

  const headers = ["Receipt slip (SI)", "Date", "Supplier", "Item", "Code", "Quantity", "Received By"];
  const rows = batches.flatMap((batch) =>
    batch.items.map((item) => [
      batch.refNo,
      formatDateForExport(batch.createdAt),
      batch.supplier.name,
      item.product.name,
      item.product.code,
      String(item.qty),
      batch.byUser.name,
    ])
  );
  // The cap applies at the batch level, not the flattened row level (one batch
  // can have several items) — a batch-level shortfall means the export was cut
  // short even though we can't say exactly how many rows that would've been.
  return { headers, rows, truncated: batches.length < totalBatches };
}

export type StockOutFilters = { mrfNumber?: string; date?: string; item?: string; project?: string; technician?: string };

/** Each filled-in field is its own AND'd condition — not one free-text box
 * OR-ing across everything. Filling "Item" + "Technician" narrows to rows
 * matching BOTH, not either. Shared by the paginated list and the export
 * route, so both apply exactly the same rows. */
function buildStockOutWhere(filters: StockOutFilters = {}) {
  const { mrfNumber, date, item, project, technician } = filters;
  const dateRange = date ? tryParseDateRange(date) : null;

  const and: object[] = [];
  if (mrfNumber) and.push({ mrf: { refNo: { contains: mrfNumber, mode: "insensitive" as const } } });
  if (project) and.push({ mrf: { project: { contains: project, mode: "insensitive" as const } } });
  if (technician) and.push({ technician: { name: { contains: technician, mode: "insensitive" as const } } });
  if (item) {
    and.push({
      product: {
        OR: [
          { name: { contains: item, mode: "insensitive" as const } },
          { code: { contains: item, mode: "insensitive" as const } },
        ],
      },
    });
  }
  if (dateRange) and.push({ createdAt: dateRange });

  return and.length ? { AND: and } : {};
}

async function fetchStockOutData(page: number, filters: StockOutFilters = {}) {
  const where = buildStockOutWhere(filters);

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

export async function getStockOutData(params: { page?: number } & StockOutFilters) {
  const page = Math.max(1, params.page ?? 1);
  const filters: StockOutFilters = {
    mrfNumber: params.mrfNumber?.trim() || undefined,
    date: params.date?.trim() || undefined,
    item: params.item?.trim() || undefined,
    project: params.project?.trim() || undefined,
    technician: params.technician?.trim() || undefined,
  };
  const hasFilter = Object.values(filters).some(Boolean);
  if (page === 1 && !hasFilter) return loadFirstPageStockOut();
  return fetchStockOutData(page, filters);
}

export type StockOutData = Awaited<ReturnType<typeof getStockOutData>>;

/** Same filters as the paginated list, but every matching row (capped) —
 * feeds the screen's "download what I'm looking at" export button. */
export async function getStockOutExportRows(filters: StockOutFilters) {
  const where = buildStockOutWhere(filters);
  const [total, rows] = await Promise.all([
    prisma.stockOut.count({ where }),
    prisma.stockOut.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_CAP,
      include: { product: true, technician: true, mrf: true, byUser: true },
    }),
  ]);

  const headers = ["Release slip (SO)", "Date", "Technician", "Item", "Code", "Qty", "Request # (MRF)", "Project", "Released By"];
  return {
    headers,
    truncated: rows.length < total,
    rows: rows.map((so) => [
      so.refNo,
      formatDateForExport(so.createdAt),
      so.technician.name,
      so.product.name,
      so.product.code,
      String(so.qty),
      so.mrf?.refNo ?? "—",
      so.mrf?.project ?? "—",
      so.byUser.name,
    ]),
  };
}

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
