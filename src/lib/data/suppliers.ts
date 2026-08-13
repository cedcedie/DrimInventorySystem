import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

export async function getSuppliersData() {
  "use cache";
  tagAndLife("suppliers", CACHE_SECONDS.list);

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      stockInBatches: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { stockInBatches: true } },
    },
    take: 500,
  });

  return {
    rows: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contact: s.contact,
      supplies: s.supplies,
      lastDelivery: s.stockInBatches[0]?.createdAt.toISOString() ?? null,
      deliveryCount: s._count.stockInBatches,
    })),
  };
}

export type SuppliersData = Awaited<ReturnType<typeof getSuppliersData>>;
