/**
 * ONE-TIME handover script. Wipes every mock/demo row seeded by
 * prisma/seed.ts (all products, categories, suppliers, technicians, MRFs,
 * stock in/out, purchase orders/requests, adjustments, activity log,
 * notifications, uploaded images, the demo user accounts, and the
 * permission-matrix overrides) and creates exactly one real Owner login so
 * the app isn't locked out afterward — there's no self-signup screen, so at
 * least one working account has to survive the wipe.
 *
 * Kept, deliberately: CompanySettings (the real company name/address/currency
 * — that's not mock data, it's the actual client info the seed hardcoded).
 * RoleDef/RolePermission/Permission are wiped along with everything else —
 * see src/lib/permissionDefaults.ts: the app falls back to sane built-in
 * defaults per role whenever no DB row exists, so an empty permissions table
 * is a normal, fully-working state, not a broken one.
 *
 * Usage:
 *   pnpm tsx scripts/reset-for-handover.ts --yes --owner-username=<username> --owner-name="<Full Name>"
 *
 * Requires --yes as an explicit confirmation flag (prevents an accidental
 * run). Prints the DATABASE_URL host before doing anything so you can
 * double-check you're pointed at the right database. Generates a random
 * strong password for the new Owner account and prints it ONCE — it is not
 * stored anywhere in plaintext. Log in with it immediately and change it via
 * Profile > Change Password.
 */
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const confirmed = args.includes("--yes");
  const username = args.find((a) => a.startsWith("--owner-username="))?.split("=")[1];
  const name = args.find((a) => a.startsWith("--owner-name="))?.split("=")[1];
  return { confirmed, username, name };
}

function generatePassword(): string {
  // 16 random bytes, base64url-encoded — short enough to read/type once,
  // long and random enough not to need anything fancier for a one-time
  // handoff password the client changes on first login.
  return randomBytes(16).toString("base64url");
}

async function main() {
  const { confirmed, username, name } = parseArgs();

  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbHost = dbUrl.match(/@([^/]+)\//)?.[1] ?? "(unknown — DATABASE_URL not set?)";

  console.log(`Target database host: ${dbHost}`);

  if (!confirmed) {
    console.log(`
This deletes ALL products, categories, suppliers, technicians, MRFs, stock
in/out records, purchase orders/requests, adjustments, activity log,
notifications, uploaded images, and every user account (including the demo
owner/admin/warehouse/technician logins) on the database above.

Company settings (name/address/currency) are kept.

Re-run with --yes to actually do this, e.g.:
  pnpm tsx scripts/reset-for-handover.ts --yes --owner-username=owner --owner-name="Jane Dela Cruz"
`);
    process.exit(1);
  }

  if (!username || !name) {
    console.error("Missing --owner-username=<username> and/or --owner-name=\"<Full Name>\" for the new Owner account.");
    process.exit(1);
  }

  console.log("Wiping data...");

  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.roleDef.deleteMany(),
    prisma.stockOut.deleteMany(),
    prisma.stockIn.deleteMany(),
    prisma.mrfItem.deleteMany(),
    prisma.stockAdjustment.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.purchaseRequestItem.deleteMany(),
    prisma.purchaseRequest.deleteMany(),
    prisma.stockInBatch.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.mrf.deleteMany(),
    prisma.technician.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.category.deleteMany(),
    prisma.storedBlob.deleteMany(),
    prisma.refCounter.deleteMany(),
    // Frees the FK before Users are deleted below — company info itself is kept.
    prisma.companySettings.updateMany({ data: { updatedById: null } }),
    prisma.user.deleteMany(),
  ]);

  console.log("Wipe complete. Creating Owner account...");

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { username, name, role: "OWNER", status: "ACTIVE", passwordHash },
  });

  console.log(`
Done. Log in with:
  Username: ${username}
  Password: ${password}

This password is shown ONCE and is not saved anywhere — copy it now.
Change it immediately after logging in (Profile > Change Password).
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
