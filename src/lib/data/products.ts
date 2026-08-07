import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

async function loadProductsPage(page: number) {
  "use cache";
  tagAndLife("products", CACHE_SECONDS.list);

  const [total, products, categories, suppliers] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({
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

export async function getProductsData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  return loadProductsPage(page);
}

export type ProductsData = Awaited<ReturnType<typeof getProductsData>>;
