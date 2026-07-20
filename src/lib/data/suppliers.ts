import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

async function fetchSuppliersData() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      stockIns: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { stockIns: true } },
    },
  });

  return {
    rows: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contact: s.contact,
      supplies: s.supplies,
      lastDelivery: s.stockIns[0]?.createdAt.toISOString() ?? null,
      deliveryCount: s._count.stockIns,
    })),
  };
}

export const getSuppliersData = unstable_cache(fetchSuppliersData, ["suppliers-data"], {
  revalidate: 20,
  tags: ["suppliers"],
});

export type SuppliersData = Awaited<ReturnType<typeof getSuppliersData>>;
