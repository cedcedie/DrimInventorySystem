import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

export async function getTechniciansData(params: { page?: number } = {}) {
  "use cache";
  tagAndLife("technicians", CACHE_SECONDS.list);
  const page = params.page ?? 1;

  const [total, technicians] = await Promise.all([
    prisma.technician.count(),
    prisma.technician.findMany({
      orderBy: { name: "asc" },
      include: {
        mrfs: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { items: { include: { product: { select: { name: true } } } } },
        },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    rows: technicians.map((t) => ({
      id: t.id,
      name: t.name,
      empNo: t.empNo,
      position: t.position,
      recentMrfs: t.mrfs.map((mrf) => {
        const firstItem = mrf.items[0];
        const qty = mrf.items.reduce((sum, item) => sum + item.qtyRequested, 0);
        const itemSummary =
          mrf.items.length <= 1
            ? (firstItem?.product.name ?? "No items")
            : `${mrf.items.length} items`;
        return {
          id: mrf.id,
          refNo: mrf.refNo,
          itemSummary,
          qty,
          date: mrf.createdAt.toISOString(),
        };
      }),
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

export type TechniciansData = Awaited<ReturnType<typeof getTechniciansData>>;
