import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

export type ProductsFilters = { code?: string; name?: string; supplier?: string; category?: string };

/** Each filled-in field is its own AND'd condition — not one free-text box
 * OR-ing across everything. Shared by the paginated list and the export
 * route, so both apply exactly the same rows. */
function buildProductsWhere(filters: ProductsFilters) {
  const { code, name, supplier, category } = filters;
  const and: object[] = [{ archivedAt: null }];
  if (category && category !== "All") and.push({ category: { name: category } });
  if (code) and.push({ code: { contains: code, mode: "insensitive" as const } });
  if (name) and.push({ name: { contains: name, mode: "insensitive" as const } });
  if (supplier) and.push({ supplier: { name: { contains: supplier, mode: "insensitive" as const } } });
  return { AND: and };
}

async function fetchProductsData(page: number, filters: ProductsFilters) {
  const where = buildProductsWhere(filters);

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
  return fetchProductsData(1, {});
}

export async function getProductsData(params: { page?: number } & ProductsFilters) {
  const page = Math.max(1, params.page ?? 1);
  const filters: ProductsFilters = {
    code: params.code?.trim() || undefined,
    name: params.name?.trim() || undefined,
    supplier: params.supplier?.trim() || undefined,
    category: params.category?.trim() || undefined,
  };
  const hasFilter = Object.values(filters).some((v) => v && v !== "All");

  if (!hasFilter && page === 1) {
    return loadDefaultProducts();
  }
  return fetchProductsData(page, filters);
}

export type ProductsData = Awaited<ReturnType<typeof getProductsData>>;
