import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

/** Sidebar badge counts — tagged so entity mutations refresh nav badges. */
export async function getBadgeCounts() {
  "use cache";
  tagAndLife(["products", "suppliers", "users", "technicians"], CACHE_SECONDS.dashboard);

  const [productCount, supplierCount, userCount, technicianCount] = await Promise.all([
    prisma.product.count({ where: { archivedAt: null } }),
    prisma.supplier.count(),
    prisma.user.count(),
    prisma.technician.count(),
  ]);

  return { productCount, supplierCount, userCount, technicianCount };
}
