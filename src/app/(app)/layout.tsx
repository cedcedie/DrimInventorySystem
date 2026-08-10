import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PermissionsProvider } from "@/components/PermissionsProvider";
import { MODULE_ACCESS } from "@/lib/rbac";
import { getEffectivePermissions } from "@/lib/effectivePermissions";
import { isConfigurableModule } from "@/lib/permissionDefaults";
import { NAV_GROUPS } from "@/lib/navConfig";
import { getBadgeCounts } from "@/lib/data/badges";

function canViewSegment(
  segment: string,
  role: Role,
  perms: Awaited<ReturnType<typeof getEffectivePermissions>>
): boolean {
  if (isConfigurableModule(segment)) {
    if (perms[segment]?.canView) return true;
    // Technicians use the Stock screen for MRFs — only they get this bridge.
    if (segment === "stock" && role === "TECHNICIAN" && perms.mrf?.canView) return true;
    return false;
  }
  return MODULE_ACCESS[role]?.includes(segment) ?? false;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;

  const [badgeCounts, hdrs, perms] = await Promise.all([
    getBadgeCounts(),
    headers(),
    getEffectivePermissions(session.user.id, role),
  ]);

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
