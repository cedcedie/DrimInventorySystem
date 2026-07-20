import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

async function fetchTechniciansData() {
  const technicians = await prisma.technician.findMany({
    orderBy: { name: "asc" },
    include: {
      mrfs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { product: true },
      },
    },
  });

  return {
    rows: technicians.map((t) => {
      const recentMrf = t.mrfs[0];
      return {
        id: t.id,
        name: t.name,
        empNo: t.empNo,
        position: t.position,
        recent: recentMrf
          ? `${recentMrf.refNo} · ${recentMrf.product.name} × ${recentMrf.qty}`
          : "No recent activity",
      };
    }),
  };
}

export const getTechniciansData = unstable_cache(fetchTechniciansData, ["technicians-data"], {
  revalidate: 20,
  tags: ["technicians"],
});

export type TechniciansData = Awaited<ReturnType<typeof getTechniciansData>>;
