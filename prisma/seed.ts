import { PrismaClient, MrfStatus, Role, UserStatus } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Seed data extracted verbatim (structure + generation logic) from
// design_handoff_drim_inventory/DRIM Inventory System v3.dc.html `state = {...}` block.

const CATEGORY_NAMES = ["Pipe", "Metal", "Condensing Unit", "Evaporator", "Accessories", "Valves"];

const baseProducts = [
  { code: "PIP-012", name: 'Copper Pipe 1/2"', category: "Pipe", stocks: 320, unit: "Meter", amount: 185, min: 50, supplier: "Davao Pipe Center" },
  { code: "MET-034", name: "Galvanized Sheet 4x8", category: "Metal", stocks: 46, unit: "Pcs", amount: 890, min: 20, supplier: "Mindanao Metal Supply" },
  { code: "CDU-007", name: "Condensing Unit 2.5HP", category: "Condensing Unit", stocks: 4, unit: "Pcs", amount: 42500, min: 6, supplier: "CoolTech Distributors" },
  { code: "EVA-011", name: "Evaporator Coil 2HP", category: "Evaporator", stocks: 9, unit: "Pcs", amount: 18750, min: 5, supplier: "CoolTech Distributors" },
  { code: "ACC-058", name: "Insulation Tape", category: "Accessories", stocks: 0, unit: "Pcs", amount: 65, min: 30, supplier: "Davao Pipe Center" },
  { code: "VAL-019", name: 'Ball Valve 3/4"', category: "Valves", stocks: 12, unit: "Pcs", amount: 340, min: 15, supplier: "Davao Pipe Center" },
  { code: "PIP-020", name: 'PVC Pipe 2"', category: "Pipe", stocks: 140, unit: "Meter", amount: 96, min: 40, supplier: "Davao Pipe Center" },
];

const generatedNames = [
  'Copper Pipe 3/4"', 'Copper Pipe 1"', 'PVC Pipe 4"', 'Flexible Duct 10"', "Angle Bar 2x2",
  "Stainless Sheet 4x8", "C-Purlin 2x4", "Condensing Unit 1.5HP", "Condensing Unit 5HP",
  "Evaporator Coil 1HP", "Evaporator Coil 3HP", "Refrigerant R410A", "Refrigerant R22",
  'Pipe Insulation 1/2"', "Vibration Pad", "Mounting Bracket", 'Gate Valve 1/2"',
  'Check Valve 3/4"', "Expansion Valve", 'Solenoid Valve 1/2"', "Teflon Tape", "Brazing Rod",
];
const generatedCats = [
  "Pipe", "Pipe", "Pipe", "Accessories", "Metal", "Metal", "Metal", "Condensing Unit",
  "Condensing Unit", "Evaporator", "Evaporator", "Accessories", "Accessories", "Accessories",
  "Accessories", "Accessories", "Valves", "Valves", "Valves", "Valves", "Accessories", "Accessories",
];
const CATEGORY_PREFIX: Record<string, string> = {
  Pipe: "PIP", Metal: "MET", "Condensing Unit": "CDU", Evaporator: "EVA", Accessories: "ACC", Valves: "VAL",
};
const generatedStocks = [85, 60, 200, 35, 48, 22, 64, 3, 2, 7, 5, 18, 6, 90, 40, 55, 25, 14, 8, 10, 120, 75];
const generatedUnits = [
  "Meter", "Meter", "Meter", "Meter", "Pcs", "Pcs", "Pcs", "Pcs", "Pcs", "Pcs", "Pcs", "Pcs",
  "Pcs", "Meter", "Pcs", "Pcs", "Pcs", "Pcs", "Pcs", "Pcs", "Pcs", "Pcs",
];
const generatedAmounts = [
  265, 340, 180, 220, 410, 1450, 380, 31500, 68000, 12800, 24500, 3850, 4200, 45, 120, 85, 290, 310, 1650, 980, 18, 95,
];
const SUPPLIER_CYCLE = ["Davao Pipe Center", "Mindanao Metal Supply", "CoolTech Distributors"];

const products = baseProducts.concat(
  generatedNames.map((name, i) => {
    const category = generatedCats[i];
    const prefix = CATEGORY_PREFIX[category];
    const stocks = generatedStocks[i];
    return {
      code: `${prefix}-${100 + i}`,
      name,
      category,
      stocks,
      unit: generatedUnits[i],
      amount: generatedAmounts[i],
      min: Math.max(5, Math.round(stocks * 0.3)),
      supplier: SUPPLIER_CYCLE[i % 3],
    };
  })
);

const suppliers = [
  { name: "Davao Pipe Center", contact: "(082) 224-1180", supplies: "Pipes, valves, accessories" },
  { name: "Mindanao Metal Supply", contact: "sales@mms.ph", supplies: "Sheets, structural metal" },
  { name: "CoolTech Distributors", contact: "(082) 305-7742", supplies: "Condensing units, evaporators" },
];

const technicians = [
  { empNo: "EMP-0147", name: "R. Dela Cruz", position: "HVAC Technician", loginUsername: "technician" },
  { empNo: "EMP-0132", name: "J. Mendoza", position: "Refrigeration Engineer", loginUsername: "j.mendoza" },
  { empNo: "EMP-0155", name: "A. Villanueva", position: "HVAC Technician", loginUsername: null },
];

type SeedUser = { username: string; name: string; role: Role; status: UserStatus };

const demoUsers: SeedUser[] = [
  { username: "owner", name: "D. Ramirez", role: Role.OWNER, status: UserStatus.ACTIVE },
  { username: "admin", name: "M. Santos", role: Role.ADMIN, status: UserStatus.ACTIVE },
  { username: "warehouse", name: "K. Uy", role: Role.WAREHOUSE_STAFF, status: UserStatus.ACTIVE },
  { username: "technician", name: "R. Dela Cruz", role: Role.TECHNICIAN, status: UserStatus.ACTIVE },
];

const extraUsers: SeedUser[] = [
  { username: "j.mendoza", name: "J. Mendoza", role: Role.TECHNICIAN, status: UserStatus.ACTIVE },
  { username: "l.tan", name: "L. Tan", role: Role.WAREHOUSE_STAFF, status: UserStatus.INACTIVE },
];

const stockInsSeed = [
  { ref: "SI-0442", productCode: "MET-034", supplierName: "Mindanao Metal Supply", qty: 24, byUsername: "warehouse" },
  { ref: "SI-0441", productCode: "CDU-007", supplierName: "CoolTech Distributors", qty: 2, byUsername: "l.tan" },
  { ref: "SI-0440", productCode: "PIP-012", supplierName: "Davao Pipe Center", qty: 100, byUsername: "warehouse" },
  { ref: "SI-0439", productCode: "EVA-011", supplierName: "CoolTech Distributors", qty: 4, byUsername: "warehouse" },
];

const mrfsSeed = [
  { refNo: "MRF-118", techEmpNo: "EMP-0147", productCode: "PIP-012", qty: 12, project: "Northgate Cold Storage", status: MrfStatus.FULFILLED },
  { refNo: "MRF-114", techEmpNo: "EMP-0147", productCode: "ACC-058", qty: 10, project: "Northgate Cold Storage", status: MrfStatus.FULFILLED },
  { refNo: "MRF-117", techEmpNo: "EMP-0132", productCode: "VAL-019", qty: 6, project: "Riverside Mall Retrofit", status: MrfStatus.FULFILLED },
  { refNo: "MRF-115", techEmpNo: "EMP-0155", productCode: "EVA-011", qty: 1, project: "Harborview Warehouse", status: MrfStatus.FULFILLED },
  { refNo: "MRF-120", techEmpNo: "EMP-0147", productCode: "VAL-019", qty: 4, project: "Northgate Cold Storage", status: MrfStatus.PENDING },
];

const stockOutsSeed = [
  { ref: "SO-0290", productCode: "PIP-012", mrfRef: "MRF-118", techEmpNo: "EMP-0147", qty: 12, byUsername: "warehouse" },
  { ref: "SO-0289", productCode: "VAL-019", mrfRef: "MRF-117", techEmpNo: "EMP-0132", qty: 6, byUsername: "warehouse" },
  { ref: "SO-0288", productCode: "EVA-011", mrfRef: "MRF-115", techEmpNo: "EMP-0155", qty: 1, byUsername: "warehouse" },
  { ref: "SO-0287", productCode: "ACC-058", mrfRef: "MRF-114", techEmpNo: "EMP-0147", qty: 10, byUsername: "warehouse" },
];

const activityBase = [
  { user: "warehouse", action: "Recorded Stock In — 24 × Galvanized Sheet 4x8", refNo: "SI-0442" },
  { user: "owner", action: "Set min. stock level on Condensing Unit 2.5HP to 6", refNo: "CDU-007" },
  { user: "warehouse", action: 'Released Stock Out — 12 m Copper Pipe 1/2"', refNo: "SO-0290" },
  { user: "j.mendoza", action: 'Returned 2 × Ball Valve 3/4" unused', refNo: "MRF-117" },
  { user: "admin", action: "Generated Transaction Report (Jul 1–17)", refNo: "RPT-088" },
  { user: "l.tan", action: "Recorded Stock In — 2 × Condensing Unit 2.5HP", refNo: "SI-0441" },
  { user: "warehouse", action: "Released Stock Out — 1 × Evaporator Coil 2HP", refNo: "SO-0288" },
  { user: "owner", action: 'Added product PVC Pipe 2" to catalog', refNo: "PIP-020" },
];

const ACTIVITY_ACTORS = ["warehouse", "l.tan", "admin", "owner", "technician", "j.mendoza"];
const ACTIVITY_ACTIONS = [
  'Recorded Stock In — 40 m Copper Pipe 3/4"',
  'Released Stock Out — 6 × Gate Valve 1/2"',
  "Generated Low Stock Report",
  "Updated product amount on Brazing Rod",
  "Filed MRF for Expansion Valve × 2",
  'Returned 1 × Solenoid Valve 1/2" unused',
];
const ACTIVITY_REFS = (i: number) => [
  `SI-04${38 - (i % 20)}`,
  `SO-02${86 - (i % 20)}`,
  `RPT-0${87 - (i % 10)}`,
  `ACC-1${10 + (i % 10)}`,
  `MRF-1${13 - (i % 9)}`,
  `MRF-1${12 - (i % 9)}`,
][i % 6];

const activitySeed = activityBase.concat(
  Array.from({ length: 28 }, (_, i) => ({
    user: ACTIVITY_ACTORS[i % 6],
    action: ACTIVITY_ACTIONS[i % 6],
    refNo: ACTIVITY_REFS(i),
  }))
);

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  // Single-row company profile. Values match what used to be hardcoded in
  // src/lib/data/settings.ts, so the Settings screen looks unchanged.
  await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: "DRIM Refrigeration & Industrial Services",
      warehouseLocation: "Km. 7, Diversion Road, Davao City",
      currency: "PHP — Philippine Peso (₱)",
    },
  });

  const categories = await Promise.all(
    CATEGORY_NAMES.map((name) => prisma.category.upsert({ where: { name }, update: {}, create: { name } }))
  );
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const supplierRecords = await Promise.all(
    suppliers.map((s) =>
      prisma.supplier.upsert({ where: { name: s.name }, update: {}, create: s })
    )
  );
  const supplierIdByName = new Map(supplierRecords.map((s) => [s.name, s.id]));

  const productRecords = await Promise.all(
    products.map((p) =>
      prisma.product.upsert({
        where: { code: p.code },
        update: {},
        create: {
          code: p.code,
          name: p.name,
          categoryId: categoryIdByName.get(p.category)!,
          unit: p.unit,
          amount: p.amount,
          stocks: p.stocks,
          minLevel: p.min,
          supplierId: supplierIdByName.get(p.supplier),
        },
      })
    )
  );
  const productIdByCode = new Map(productRecords.map((p) => [p.code, p.id]));

  const userRecords = await Promise.all(
    [...demoUsers, ...extraUsers].map((u) =>
      prisma.user.upsert({
        where: { username: u.username },
        update: {},
        create: {
          username: u.username,
          name: u.name,
          role: u.role,
          status: u.status,
          passwordHash,
        },
      })
    )
  );
  const userIdByUsername = new Map(userRecords.map((u) => [u.username, u.id]));

  const technicianRecords = await Promise.all(
    technicians.map((t) =>
      prisma.technician.upsert({
        where: { empNo: t.empNo },
        update: { userId: t.loginUsername ? userIdByUsername.get(t.loginUsername) : null },
        create: {
          empNo: t.empNo,
          name: t.name,
          position: t.position,
          userId: t.loginUsername ? userIdByUsername.get(t.loginUsername) : undefined,
        },
      })
    )
  );
  const technicianIdByEmpNo = new Map(technicianRecords.map((t) => [t.empNo, t.id]));

  const mrfRecords = await Promise.all(
    mrfsSeed.map(async (m) => {
      const productId = productIdByCode.get(m.productCode)!;
      return prisma.mrf.upsert({
        where: { refNo: m.refNo },
        update: {},
        create: {
          refNo: m.refNo,
          technicianId: technicianIdByEmpNo.get(m.techEmpNo)!,
          project: m.project,
          status: m.status,
          items: {
            create: {
              productId,
              qtyRequested: m.qty,
              qtyFulfilled: m.status === "FULFILLED" ? m.qty : 0,
            },
          },
        },
      });
    })
  );
  const mrfIdByRef = new Map(mrfRecords.map((m) => [m.refNo, m.id]));

  await Promise.all(
    stockInsSeed.map((si) =>
      prisma.stockIn.upsert({
        where: { refNo: si.ref },
        update: {},
        create: {
          refNo: si.ref,
          productId: productIdByCode.get(si.productCode)!,
          supplierId: supplierIdByName.get(si.supplierName)!,
          qty: si.qty,
          byUserId: userIdByUsername.get(si.byUsername)!,
        },
      })
    )
  );

  await Promise.all(
    stockOutsSeed.map((so) =>
      prisma.stockOut.upsert({
        where: { refNo: so.ref },
        update: {},
        create: {
          refNo: so.ref,
          productId: productIdByCode.get(so.productCode)!,
          mrfId: mrfIdByRef.get(so.mrfRef),
          technicianId: technicianIdByEmpNo.get(so.techEmpNo)!,
          qty: so.qty,
          byUserId: userIdByUsername.get(so.byUsername)!,
        },
      })
    )
  );

  for (const a of activitySeed) {
    const userId = userIdByUsername.get(a.user);
    if (!userId) continue;
    await prisma.activityLog.create({
      data: { userId, action: a.action, refNo: a.refNo },
    });
  }

  console.log(`Seeded: ${categories.length} categories, ${productRecords.length} products, ${supplierRecords.length} suppliers, ${technicianRecords.length} technicians, ${userRecords.length} users, ${mrfRecords.length} MRFs, ${stockInsSeed.length} stock-ins, ${stockOutsSeed.length} stock-outs, ${activitySeed.length} activity rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
