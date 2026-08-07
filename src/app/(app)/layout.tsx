import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { PermissionsProvider } from "@/components/PermissionsProvider";
import { MODULE_ACCESS } from "@/lib/rbac";
import { getEffectivePermissions, isConfigurableModule } from "@/lib/effectivePermissions";
import { NAV_GROUPS } from "@/lib/navConfig";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

/** Tagged with entity tags so product/supplier/user/tech mutations refresh badges. */
async function getBadgeCounts() {
  "use cache";
  tagAndLife(["products", "suppliers", "users", "technicians"], CACHE_SECONDS.dashboard);

  const [productCount, supplierCount, userCount, technicianCount] = await Promise.all([
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.user.count(),
    prisma.technician.count(),
  ]);
  return { productCount, supplierCount, userCount, technicianCount };
}

function canViewSegment(
  segment: string,
  role: Role,
  perms: Awaited<ReturnType<typeof getEffectivePermissions>>
): boolean {
  if (isConfigurableModule(segment)) {
    return perms[segment]?.canView || (segment === "stock" && perms.mrf?.canView) || false;
  }
  return MODULE_ACCESS[role]?.includes(segment) ?? false;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, badgeCounts, hdrs] = await Promise.all([auth(), getBadgeCounts(), headers()]);
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const perms = await getEffectivePermissions(session.user.id, role);

  const pathname = hdrs.get("x-pathname") ?? "";
  const pageSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  if (pageSegment && pageSegment !== "api" && !canViewSegment(pageSegment, role, perms)) {
    redirect("/dashboard");
  }

  const accessSegments = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.segment)).filter((segment) =>
    canViewSegment(segment, role, perms)
  );

  const { productCount, supplierCount, userCount, technicianCount } = badgeCounts;

  const badges: Record<string, string> = {
    inventory: String(productCount),
    suppliers: String(supplierCount),
    users: String(userCount),
    technicians: String(technicianCount),
  };

  return (
    <PermissionsProvider permissions={perms}>
      <AppShell
        userName={session.user.name ?? session.user.username}
        role={role}
        badges={badges}
        accessSegments={accessSegments}
      >
        {children}
      </AppShell>
    </PermissionsProvider>
  );
}
