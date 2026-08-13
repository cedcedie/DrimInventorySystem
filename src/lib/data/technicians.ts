import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

export async function getTechniciansData() {
  "use cache";
  tagAndLife("technicians", CACHE_SECONDS.list);

  const technicians = await prisma.technician.findMany({
    orderBy: { name: "asc" },
    include: {
      mrfs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: { include: { product: { select: { name: true } } } } },
      },
    },
    take: 500,
  });

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
  };
}

export type TechniciansData = Awaited<ReturnType<typeof getTechniciansData>>;
