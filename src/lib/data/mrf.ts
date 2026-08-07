import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

/** Resolves the Technician roster row linked to a logged-in TECHNICIAN user. */
export async function getTechnicianForUser(userId: string) {
  return prisma.technician.findUnique({ where: { userId } });
}

async function loadMrfsForTechnician(technicianId: string) {
  "use cache";
  tagAndLife(["mrf", `mrf-tech-${technicianId}`], CACHE_SECONDS.short);

  const mrfs = await prisma.mrf.findMany({
    where: { technicianId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  return {
    rows: mrfs.map((m) => {
      const totalRequested = m.items.reduce((sum, item) => sum + item.qtyRequested, 0);
      const totalFulfilled = m.items.reduce((sum, item) => sum + item.qtyFulfilled, 0);
      const itemCount = m.items.length;

      let mrfStatus: "PENDING" | "PARTIAL" | "FULFILLED" | "CANCELLED" = m.status;
      if (m.status !== "CANCELLED") {
        if (totalFulfilled === 0) {
          mrfStatus = "PENDING";
        } else if (totalFulfilled >= totalRequested) {
          mrfStatus = "FULFILLED";
        } else {
          mrfStatus = "PARTIAL";
        }
      }

      return {
        id: m.id,
        mrf: m.refNo,
        date: m.createdAt.toISOString(),
        item: itemCount === 1 ? m.items[0].product.name : `${itemCount} items`,
        qty: totalRequested,
        qtyFulfilled: totalFulfilled,
        project: m.project,
        status: mrfStatus,
        itemCount,
      };
    }),
  };
}

export async function getMrfsForTechnician(technicianId: string) {
  return loadMrfsForTechnician(technicianId);
}

export type MrfListData = Awaited<ReturnType<typeof getMrfsForTechnician>>;
