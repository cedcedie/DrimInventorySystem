import { prisma } from "@/lib/prisma";

export const REPORT_TYPES = ["Stock Report", "Transaction Report", "Low Stock Report", "Supplier Report"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportRow {
  label: string;
  value: string;
}

/** Pulls the raw data + a flat table of rows for a given report type and date
 * range, used both for the on-screen preview and the exported PDF. */
export async function buildReportData(type: ReportType, from: Date, to: Date) {
  if (type === "Stock Report") {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { code: "asc" },
    });
    return {
      headers: ["Code", "Name", "Category", "Stocks", "Unit", "Amount"],
      rows: products.map((p) => [
        p.code,
        p.name,
        p.category.name,
        String(p.stocks),
        p.unit,
        Number(p.amount).toFixed(2),
      ]),
      summary: `${products.length} products · as of ${to.toLocaleDateString("en-PH")}`,
    };
  }

  if (type === "Transaction Report") {
    const [stockIns, stockOuts] = await Promise.all([
      prisma.stockIn.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { product: true, supplier: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockOut.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { product: true, technician: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const rows = [
      ...stockIns.map((si) => [
        si.createdAt.toLocaleDateString("en-PH"),
        "Stock-In",
        si.refNo,
        `${si.qty} × ${si.product.name} from ${si.supplier.name}`,
      ]),
      ...stockOuts.map((so) => [
        so.createdAt.toLocaleDateString("en-PH"),
        "Stock-Out",
        so.refNo,
        `${so.qty} × ${so.product.name} to ${so.technician.name}`,
      ]),
    ].sort((a, b) => (a[0] < b[0] ? 1 : -1));

    return {
      headers: ["Date", "Type", "Ref", "Description"],
      rows,
      summary: `${rows.length} transactions · ${from.toLocaleDateString("en-PH")}–${to.toLocaleDateString("en-PH")}`,
    };
  }

  if (type === "Low Stock Report") {
    const products = await prisma.product.findMany({ include: { category: true } });
    const flagged = products.filter((p) => p.stocks <= p.minLevel);
    return {
      headers: ["Code", "Name", "Category", "Stocks", "Min. Level"],
      rows: flagged.map((p) => [p.code, p.name, p.category.name, String(p.stocks), String(p.minLevel)]),
      summary: `${flagged.length} items flagged`,
    };
  }

  // Supplier Report
  const suppliers = await prisma.supplier.findMany({
    include: {
      stockIns: { where: { createdAt: { gte: from, lte: to } } },
    },
    orderBy: { name: "asc" },
  });
  return {
    headers: ["Supplier", "Deliveries in Range", "Total Qty"],
    rows: suppliers.map((s) => [
      s.name,
      String(s.stockIns.length),
      String(s.stockIns.reduce((acc, si) => acc + si.qty, 0)),
    ]),
    summary: `${suppliers.length} suppliers · ${from.toLocaleDateString("en-PH")}–${to.toLocaleDateString("en-PH")}`,
  };
}
