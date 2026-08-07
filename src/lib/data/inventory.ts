import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

async function fetchInventoryData(q: string, category: string, page: number) {
  const where = {
    AND: [
      category !== "All" ? { category: { name: category } } : {},
      q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
    ],
  };

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

/** Default inventory view (no filters) — cached. Filtered views hit the DB. */
async function loadDefaultInventory() {
  "use cache";
  tagAndLife("inventory", CACHE_SECONDS.list);
  return fetchInventoryData("", "All", 1);
}

export async function getInventoryData(params: { q?: string; category?: string; page?: number }) {
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "All";
  const page = Math.max(1, params.page ?? 1);

  if (!q && category === "All" && page === 1) {
    return loadDefaultInventory();
  }
  return fetchInventoryData(q, category, page);
}

export type InventoryData = Awaited<ReturnType<typeof getInventoryData>>;
