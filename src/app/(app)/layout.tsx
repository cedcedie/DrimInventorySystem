import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";

// Sidebar badge counts rarely change and cost a DB round-trip each; cache them
// for a minute instead of re-querying on every navigation.
const getBadgeCounts = unstable_cache(
  async () => {
    const [productCount, supplierCount, userCount, technicianCount] = await Promise.all([
      prisma.product.count(),
      prisma.supplier.count(),
      prisma.user.count(),
      prisma.technician.count(),
    ]);
    return { productCount, supplierCount, userCount, technicianCount };
  },
  ["sidebar-badge-counts"],
  { revalidate: 60 }
);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // These are independent — the badge counts don't depend on who's logged in,
  // so awaiting them in sequence added a needless round-trip to every navigation.
  const [session, badgeCounts] = await Promise.all([auth(), getBadgeCounts()]);
  if (!session?.user) redirect("/login");

  const { productCount, supplierCount, userCount, technicianCount } = badgeCounts;

  const badges: Record<string, string> = {
    inventory: String(productCount),
    suppliers: String(supplierCount),
    users: String(userCount),
    technicians: String(technicianCount),
  };

  return (
    <AppShell
      userName={session.user.name ?? session.user.username}
      role={session.user.role as Role}
      badges={badges}
    >
      {children}
    </AppShell>
  );
}
