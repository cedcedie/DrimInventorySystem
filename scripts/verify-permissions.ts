/**
 * Verifies role + user permission persistence and effective resolution.
 * Run: pnpm exec tsx scripts/verify-permissions.ts
 */
import { PrismaClient } from "@prisma/client";
import { defaultPermissionsFor } from "../src/lib/permissionDefaults";

const prisma = new PrismaClient();

async function main() {
  console.log("── Permission persistence check ──\n");

  // 1) Role: ensure RoleDef + RolePermission upsert works for TECHNICIAN / inventory
  const roleDef = await prisma.roleDef.upsert({
    where: { name: "TECHNICIAN" },
    update: {},
    create: { name: "TECHNICIAN", displayName: "Technician", isSystem: true },
  });

  const rolePerm = await prisma.rolePermission.upsert({
    where: { roleDefId_module: { roleDefId: roleDef.id, module: "inventory" } },
    update: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canExport: false,
    },
    create: {
      roleDefId: roleDef.id,
      module: "inventory",
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canExport: false,
    },
  });

  console.log("✓ Role TECHNICIAN / inventory saved:", {
    canView: rolePerm.canView,
    canCreate: rolePerm.canCreate,
  });

  // 2) Find a technician user (or skip)
  const tech = await prisma.user.findFirst({
    where: { role: "TECHNICIAN", status: "ACTIVE" },
    select: { id: true, name: true, username: true },
  });

  if (!tech) {
    console.log("⚠ No technician user in DB — skipping user-override check");
  } else {
    // Default for products should be no view
    const builtIn = defaultPermissionsFor("TECHNICIAN", "products");
    console.log("✓ Built-in TECHNICIAN / products:", builtIn);

    // User override: grant products view only
    const override = await prisma.permission.upsert({
      where: { userId_module: { userId: tech.id, module: "products" } },
      update: {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
      },
      create: {
        userId: tech.id,
        module: "products",
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
      },
    });

    console.log(`✓ User override for ${tech.username} / products:`, {
      canView: override.canView,
    });

    // Resolve like the app: user override wins
    const userRows = await prisma.permission.findMany({ where: { userId: tech.id } });
    const roleRows = await prisma.rolePermission.findMany({
      where: { roleDef: { name: "TECHNICIAN" } },
    });

    const resolve = (module: string) => {
      const u = userRows.find((r) => r.module === module);
      if (u) return { source: "user", ...u };
      const r = roleRows.find((r) => r.module === module);
      if (r) return { source: "role", ...r };
      return { source: "default", ...defaultPermissionsFor("TECHNICIAN", module) };
    };

    const products = resolve("products");
    const inventory = resolve("inventory");
    const mrf = resolve("mrf");

    console.log("✓ Effective products:", { source: products.source, canView: products.canView });
    console.log("✓ Effective inventory:", { source: inventory.source, canView: inventory.canView });
    console.log("✓ Effective mrf:", { source: mrf.source, canView: mrf.canView });

    if (products.source !== "user" || !products.canView) {
      throw new Error("User override for products did not win");
    }
    if (inventory.source !== "role" || !inventory.canView) {
      throw new Error("Role permission for inventory did not apply");
    }
    if (mrf.source !== "default" || !mrf.canCreate) {
      throw new Error("MRF should still use built-in default create");
    }

    // Cleanup test override so we don't leave surprise access
    await prisma.permission.deleteMany({
      where: { userId: tech.id, module: "products" },
    });
    console.log("✓ Cleaned up test user override");
  }

  // Leave role inventory view as-is (Owner may want it) — report only
  console.log("\n── All permission checks passed ──");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
