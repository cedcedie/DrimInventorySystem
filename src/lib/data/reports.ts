import { prisma } from "@/lib/prisma";
import { mrfStatusLabel } from "@/lib/mrfLifecycle";

export const REPORT_TYPES = [
  "Stock Report",
  "Transaction Report",
  "Low Stock Report",
  "Supplier Report",
  "MRF Status Report",
  "Stock Reconciliation",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_ROW_CAP = 5000;
const capNote = (count: number) => (count === REPORT_ROW_CAP ? " (showing first 5000 rows)" : "");

export interface ReportOptions {
  /** Owner & Admin only. */
  includePricing?: boolean;
}

/** Used both for the on-screen preview and the exported PDF. */
export async function buildReportData(
  type: ReportType,
  from: Date,
  to: Date,
  options: ReportOptions = {}
) {
  const includePricing = options.includePricing ?? false;

  if (type === "Stock Report") {
    const products = await prisma.product.findMany({
      where: { archivedAt: null },
      include: { category: true },
      orderBy: { code: "asc" },
      take: REPORT_ROW_CAP,
    });
    if (includePricing) {
      return {
        headers: ["Code", "Name", "Category", "Stocks", "Unit", "Unit Price", "Value"],
        columnWeights: [1, 2.33, 1.68, 0.83, 0.66, 1.09, 1.12],
        rows: products.map((p) => [
          p.code,
          p.name,
          p.category.name,
          String(p.stocks),
          p.unit,
          Number(p.amount ?? 0).toFixed(2),
          (Number(p.amount ?? 0) * p.stocks).toFixed(2),
        ]),
        summary: `${products.length} active products · as of ${to.toLocaleDateString("en-PH")}${capNote(products.length)}`,
      };
    }
    return {
      headers: ["Code", "Name", "Category", "Stocks", "Unit"],
      columnWeights: [1, 2.33, 1.68, 0.83, 0.66],
      rows: products.map((p) => [p.code, p.name, p.category.name, String(p.stocks), p.unit]),
      summary: `${products.length} active products · as of ${to.toLocaleDateString("en-PH")}${capNote(products.length)}`,
    };
  }

  if (type === "Transaction Report") {
    const [stockIns, stockOuts, adjustments] = await Promise.all([
      prisma.stockIn.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { product: true, stockInBatch: { include: { supplier: true } } },
        orderBy: { createdAt: "desc" },
        take: REPORT_ROW_CAP,
      }),
      prisma.stockOut.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: {
          product: true,
          technician: true,
          mrf: { select: { refNo: true } },
        },
        orderBy: { createdAt: "desc" },
        take: REPORT_ROW_CAP,
      }),
      prisma.stockAdjustment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { product: true },
        orderBy: { createdAt: "desc" },
        take: REPORT_ROW_CAP,
      }),
    ]);
    // Sort by the real Date, not the formatted "M/D/YYYY" display string —
    // that string isn't zero-padded, so lexical comparison puts "8/10" before
    // "8/9" and "12/1" before "9/5". Carry the Date through as a sort key,
    // sort first, then drop it from the row tuples returned to the caller.
    const rows = [
      ...stockIns.map((si) => ({
        dt: si.createdAt,
        row: [
          si.createdAt.toLocaleDateString("en-PH"),
          "Stock-In",
          si.stockInBatch.refNo,
          "—",
          `${si.qty} × ${si.product.name} from ${si.stockInBatch.supplier.name}`,
        ],
      })),
      ...stockOuts.map((so) => ({
        dt: so.createdAt,
        row: [
          so.createdAt.toLocaleDateString("en-PH"),
          "Stock-Out",
          so.refNo,
          so.mrf?.refNo ?? "—",
          `${so.qty} × ${so.product.name} to ${so.technician.name}`,
        ],
      })),
      ...adjustments.map((a) => ({
        dt: a.createdAt,
        row: [
          a.createdAt.toLocaleDateString("en-PH"),
          "Adjustment",
          a.refNo,
          "—",
          `${a.product.name}: ${a.qtyBefore} → ${a.qtyAfter} (${a.delta >= 0 ? "+" : ""}${a.delta})`,
        ],
      })),
    ]
      .sort((a, b) => b.dt.getTime() - a.dt.getTime())
      .map((r) => r.row);

    const capped =
      stockIns.length === REPORT_ROW_CAP ||
      stockOuts.length === REPORT_ROW_CAP ||
      adjustments.length === REPORT_ROW_CAP;

    return {
      headers: ["Date", "Type", "Slip / Adj #", "Request # (MRF)", "Description"],
      columnWeights: [1, 1, 0.96, 1.38, 4.91],
      rows,
      summary: `${rows.length} movements · ${from.toLocaleDateString("en-PH")}–${to.toLocaleDateString("en-PH")}${
        capped ? " (showing first 5000 rows per type)" : ""
      }`,
    };
  }

  if (type === "Low Stock Report") {
    const products = await prisma.product.findMany({
      where: { archivedAt: null },
      include: { category: true },
      take: REPORT_ROW_CAP,
    });
    const flagged = products.filter((p) => p.stocks <= p.minLevel);
    return {
      headers: ["Code", "Name", "Category", "Stocks", "Min. Level"],
      columnWeights: [1, 2.33, 1.68, 0.83, 1.07],
      rows: flagged.map((p) => [p.code, p.name, p.category.name, String(p.stocks), String(p.minLevel)]),
      summary: `${flagged.length} items flagged${capNote(products.length)}`,
    };
  }

  if (type === "MRF Status Report") {
    const mrfs = await prisma.mrf.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        technician: { select: { name: true, empNo: true } },
        items: { select: { qtyRequested: true, qtyFulfilled: true } },
      },
      orderBy: { createdAt: "desc" },
      take: REPORT_ROW_CAP,
    });
    return {
      headers: ["Request #", "Date", "Technician", "Project", "Status", "Requested", "Released", "Ext. Ref"],
      columnWeights: [1, 1.05, 2.26, 2.7, 1.48, 1.06, 0.94, 1.35],
      rows: mrfs.map((m) => {
        const requested = m.items.reduce((s, i) => s + i.qtyRequested, 0);
        const fulfilled = m.items.reduce((s, i) => s + i.qtyFulfilled, 0);
        return [
          m.refNo,
          m.createdAt.toLocaleDateString("en-PH"),
          `${m.technician.name} (${m.technician.empNo})`,
          m.project,
          mrfStatusLabel(m.status, fulfilled),
          String(requested),
          String(fulfilled),
          m.externalRefNo ?? "—",
        ];
      }),
      summary: `${mrfs.length} MRFs · ${from.toLocaleDateString("en-PH")}–${to.toLocaleDateString("en-PH")}${capNote(mrfs.length)}`,
    };
  }

  if (type === "Stock Reconciliation") {
    // Opening balance isn't tracked historically, so this shows SI-SO+ADJ deltas vs current on-hand.
    const products = await prisma.product.findMany({
      where: { archivedAt: null },
      include: { category: true },
      orderBy: { code: "asc" },
      take: REPORT_ROW_CAP,
    });
    const productIds = products.map((p) => p.id);

    const [ins, outs, adjs] = await Promise.all([
      prisma.stockIn.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, createdAt: { gte: from, lte: to } },
        _sum: { qty: true },
      }),
      prisma.stockOut.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, createdAt: { gte: from, lte: to } },
        _sum: { qty: true },
      }),
      prisma.stockAdjustment.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, createdAt: { gte: from, lte: to } },
        _sum: { delta: true },
      }),
    ]);

    const inMap = Object.fromEntries(ins.map((r) => [r.productId, r._sum.qty ?? 0]));
    const outMap = Object.fromEntries(outs.map((r) => [r.productId, r._sum.qty ?? 0]));
    const adjMap = Object.fromEntries(adjs.map((r) => [r.productId, r._sum.delta ?? 0]));

    return {
      headers: ["Code", "Name", "Category", "On hand", "SI (range)", "SO (range)", "ADJ Change", "Net movement"],
      columnWeights: [1, 2.33, 1.68, 0.92, 1.06, 1.15, 1.25, 1.49],
      rows: products.map((p) => {
        const si = inMap[p.id] ?? 0;
        const so = outMap[p.id] ?? 0;
        const adj = adjMap[p.id] ?? 0;
        const net = si - so + adj;
        return [
          p.code,
          p.name,
          p.category.name,
          String(p.stocks),
          String(si),
          String(so),
          String(adj),
          String(net),
        ];
      }),
      summary: `${products.length} products · range ${from.toLocaleDateString("en-PH")}–${to.toLocaleDateString("en-PH")} · Net movement = SI-SO+ADJ in range only (not opening balance); compare to On hand as a spot-check, not a full reconcile${capNote(products.length)}`,
    };
  }

  // Supplier Report
  const suppliers = await prisma.supplier.findMany({
    include: {
      stockInBatches: {
        where: { createdAt: { gte: from, lte: to } },
        include: { items: true },
      },
    },
    orderBy: { name: "asc" },
    take: REPORT_ROW_CAP,
  });
  return {
    headers: ["Supplier", "Deliveries in Range", "Total Qty"],
    columnWeights: [1.67, 1, 0.52],
    rows: suppliers.map((s) => [
      s.name,
      String(s.stockInBatches.length),
      String(s.stockInBatches.reduce((acc, b) => acc + b.items.reduce((sum, i) => sum + i.qty, 0), 0)),
    ]),
    summary: `${suppliers.length} suppliers · ${from.toLocaleDateString("en-PH")}–${to.toLocaleDateString("en-PH")}${capNote(suppliers.length)}`,
  };
}
