/**
 * Verifies role + user permission persistence and effective resolution.
 * Run: pnpm verify:permissions
 */
import type { Permission, RolePermission } from "../src/generated/prisma";
import { prisma } from "../src/lib/prisma";
import { defaultPermissionsFor } from "../src/lib/permissionDefaults";

type Resolved = {
  source: "user" | "role" | "default";
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
};

function resolveModule(
  module: string,
  userRows: Permission[],
  roleRows: RolePermission[]
): Resolved {
  const userRow = userRows.find((row) => row.module === module);
  if (userRow) {
    return {
      source: "user",
      canView: userRow.canView,
      canCreate: userRow.canCreate,
      canEdit: userRow.canEdit,
      canDelete: userRow.canDelete,
      canExport: userRow.canExport,
    };
  }
  const roleRow = roleRows.find((row) => row.module === module);
  if (roleRow) {
    return {
      source: "role",
      canView: roleRow.canView,
      canCreate: roleRow.canCreate,
      canEdit: roleRow.canEdit,
      canDelete: roleRow.canDelete,
      canExport: roleRow.canExport,
    };
  }
  return { source: "default", ...defaultPermissionsFor("TECHNICIAN", module) };
}

async function main() {
  console.log("── Permission persistence check ──\n");

  const roleDef = await prisma.roleDef.upsert({
    where: { name: "TECHNICIAN" },
    update: { displayName: "Technician", isSystem: true },
    create: {
      name: "TECHNICIAN",
      displayName: "Technician",
      isSystem: true,
    },
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

  const tech = await prisma.user.findFirst({
    where: { role: "TECHNICIAN", status: "ACTIVE" },
    select: { id: true, name: true, username: true },
  });

  if (!tech) {
    console.log("⚠ No technician user in DB — skipping user-override check");
    console.log("\n── Role checks passed (user checks skipped) ──");
    return;
  }

  await prisma.permission.deleteMany({
    where: { userId: tech.id, module: { in: ["products", "inventory", "mrf"] } },
  });

  const builtIn = defaultPermissionsFor("TECHNICIAN", "products");
  console.log("✓ Built-in TECHNICIAN / products:", builtIn);

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

  const userRows = await prisma.permission.findMany({ where: { userId: tech.id } });
  const roleRows = await prisma.rolePermission.findMany({
    where: { roleDef: { name: "TECHNICIAN" } },
  });

  const products = resolveModule("products", userRows, roleRows);
  const inventory = resolveModule("inventory", userRows, roleRows);
  const mrf = resolveModule("mrf", userRows, roleRows);

  console.log("✓ Effective products:", { source: products.source, canView: products.canView });
  console.log("✓ Effective inventory:", { source: inventory.source, canView: inventory.canView });
  console.log("✓ Effective mrf:", {
    source: mrf.source,
    canView: mrf.canView,
    canCreate: mrf.canCreate,
  });

  if (products.source !== "user" || !products.canView) {
    throw new Error("User override for products did not win");
  }
  if (inventory.source !== "role" || !inventory.canView) {
    throw new Error("Role permission for inventory did not apply");
  }
  if (mrf.source !== "default" || !mrf.canCreate) {
    throw new Error("MRF should still use built-in default create");
  }

  await prisma.permission.deleteMany({
    where: { userId: tech.id, module: "products" },
  });
  console.log("✓ Cleaned up test user override");

  console.log("\n── All permission checks passed ──");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
