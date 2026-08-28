import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

export type InventoryFilters = { code?: string; name?: string; category?: string };

/** Each filled-in field is its own AND'd condition — not one free-text box
 * OR-ing across everything. Shared by the paginated list and the export
 * route, so both apply exactly the same rows. */
function buildInventoryWhere(filters: InventoryFilters) {
  const { code, name, category } = filters;
  const and: object[] = [{ archivedAt: null }];
  if (category && category !== "All") and.push({ category: { name: category } });
  if (code) and.push({ code: { contains: code, mode: "insensitive" as const } });
  if (name) and.push({ name: { contains: name, mode: "insensitive" as const } });
  return { AND: and };
}

async function fetchInventoryData(filters: InventoryFilters, page: number) {
  const where = buildInventoryWhere(filters);

  const [total, products, categories, suppliers] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { category: true, supplier: true },
      orderBy: { code: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    rows: products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      categoryId: p.categoryId,
      category: p.category.name,
      stocks: p.stocks,
      unit: p.unit,
      amount: Number(p.amount),
      total: Number(p.amount) * p.stocks,
      minLevel: p.minLevel,
      supplierId: p.supplierId,
      imageKey: p.imageKey,
      status: p.stocks === 0 ? "Unavailable" : p.stocks <= p.minLevel ? "Low Stock" : "In Stock",
    })),
    categories: categories.map((c) => c.name),
    categoryList: categories.map((c) => ({ id: c.id, name: c.name })),
    supplierList: suppliers.map((s) => ({ id: s.id, name: s.name })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

/** Default inventory view (no filters) is cached; filtered views hit the DB. */
async function loadDefaultInventory() {
  "use cache";
  tagAndLife("inventory", CACHE_SECONDS.list);
  return fetchInventoryData({}, 1);
}

export async function getInventoryData(params: { page?: number } & InventoryFilters) {
  const page = Math.max(1, params.page ?? 1);
  const filters: InventoryFilters = {
    code: params.code?.trim() || undefined,
    name: params.name?.trim() || undefined,
    category: params.category?.trim() || undefined,
  };
  const hasFilter = Object.values(filters).some((v) => v && v !== "All");
  if (!hasFilter && page === 1) {
    return loadDefaultInventory();
  }
  return fetchInventoryData(filters, page);
}

export type InventoryData = Awaited<ReturnType<typeof getInventoryData>>;

const EXPORT_CAP = 2000;

/** Same filters as the paginated list, but every matching row (capped) —
 * feeds the screen's "download what I'm looking at" export button. Pricing
 * columns are included here; the route strips them for non-Owner/Admin
 * viewers, same as the list endpoint. */
export async function getInventoryExportRows(filters: InventoryFilters, includePricing: boolean) {
  const where = buildInventoryWhere(filters);
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { code: "asc" },
      take: EXPORT_CAP,
    }),
  ]);

  const headers = ["Code", "Product Name", "Category", "Stocks", "Unit", "Status", ...(includePricing ? ["Unit Cost", "Total Value"] : [])];
  const rows = products.map((p) => {
    const status = p.stocks === 0 ? "Unavailable" : p.stocks <= p.minLevel ? "Low Stock" : "In Stock";
    const base = [p.code, p.name, p.category.name, String(p.stocks), p.unit, status];
    if (!includePricing) return base;
    const amount = Number(p.amount);
    return [...base, amount.toFixed(2), (amount * p.stocks).toFixed(2)];
  });
  return { headers, rows, truncated: products.length < total };
}
