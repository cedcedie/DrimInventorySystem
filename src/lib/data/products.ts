import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

async function fetchProductsData(page: number, q: string, category: string) {
  const where = {
    AND: [
      { archivedAt: null },
      category !== "All" ? { category: { name: category } } : {},
      q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
              { supplier: { name: { contains: q, mode: "insensitive" as const } } },
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
      unit: p.unit,
      amount: Number(p.amount),
      stocks: p.stocks,
      minLevel: p.minLevel,
      supplierId: p.supplierId,
      supplier: p.supplier?.name ?? "—",
      imageKey: p.imageKey,
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

/** Default catalog view (no search/filter) is cached; filtered views hit the DB directly. */
async function loadDefaultProducts() {
  "use cache";
  tagAndLife("products", CACHE_SECONDS.list);
  return fetchProductsData(1, "", "All");
}

export async function getProductsData(params: { page?: number; q?: string; category?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "All";

  if (!q && category === "All" && page === 1) {
    return loadDefaultProducts();
  }
  return fetchProductsData(page, q, category);
}

export type ProductsData = Awaited<ReturnType<typeof getProductsData>>;
