import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

export async function getSuppliersData(params: { page?: number } = {}) {
  "use cache";
  tagAndLife("suppliers", CACHE_SECONDS.list);
  const page = params.page ?? 1;

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count(),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        stockInBatches: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { stockInBatches: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    rows: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contact: s.contact,
      supplies: s.supplies,
      lastDelivery: s.stockInBatches[0]?.createdAt.toISOString() ?? null,
      deliveryCount: s._count.stockInBatches,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

export type SuppliersData = Awaited<ReturnType<typeof getSuppliersData>>;
