import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Resolves the Technician roster row linked to a logged-in TECHNICIAN user. */
export async function getTechnicianForUser(userId: string) {
  return prisma.technician.findUnique({ where: { userId } });
}

async function fetchMrfsForTechnician(technicianId: string) {
  const mrfs = await prisma.mrf.findMany({
    where: { technicianId },
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });

  return {
    rows: mrfs.map((m) => ({
      id: m.id,
      mrf: m.refNo,
      date: m.createdAt.toISOString(),
      item: m.product.name,
      qty: m.qty,
      project: m.project,
      status: m.status,
    })),
  };
}

export async function getMrfsForTechnician(technicianId: string) {
  const cached = unstable_cache(
    () => fetchMrfsForTechnician(technicianId),
    ["mrfs-for-technician", technicianId],
    { revalidate: 10, tags: ["mrf", `mrf-tech-${technicianId}`] }
  );
  return cached();
}

export type MrfListData = Awaited<ReturnType<typeof fetchMrfsForTechnician>>;
