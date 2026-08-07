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
        take: 1,
        include: { items: { include: { product: { select: { name: true } } } } },
      },
    },
    take: 500,
  });

  return {
    rows: technicians.map((t) => {
      const recentMrf = t.mrfs[0];
      const firstItem = recentMrf?.items[0];
      const summary =
        recentMrf && firstItem
          ? recentMrf.items.length === 1
            ? `${recentMrf.refNo} · ${firstItem.product.name} × ${firstItem.qtyRequested}`
            : `${recentMrf.refNo} · ${recentMrf.items.length} items`
          : "No recent activity";
      return {
        id: t.id,
        name: t.name,
        empNo: t.empNo,
        position: t.position,
        recent: summary,
      };
    }),
  };
}

export type TechniciansData = Awaited<ReturnType<typeof getTechniciansData>>;
