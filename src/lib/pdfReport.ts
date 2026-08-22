import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

// DRIM IMS PDF letterhead — mirrors `design_handoff_ui_refresh/PDF Report
// Template.dc.html`. Colors below are the same hex values as
// src/theme/tokens.ts's light palette (pdf-lib can't import the TS module,
// so they're restated as rgb() literals — keep in sync by hand).
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const ROW_HEIGHT = 16;

const INK = rgb(0.0627, 0.0941, 0.1569); // #101828 — headings, body text
const MUTED = rgb(0.4014, 0.4392, 0.4863); // #667085 — secondary text
const MUTED2 = rgb(0.5961, 0.6353, 0.7020); // #98A2B3 — tracked labels, hairlines-adjacent
const HAIRLINE = rgb(0.9412, 0.9490, 0.9608); // #F0F2F5 — table row dividers
const RULE_DARK = rgb(0.0627, 0.0941, 0.1569); // #101828 — 1.5px table header rule
const ACCENT = rgb(1, 0.4196, 0.1725); // #FF6B2C — letterhead rule
const WARN = rgb(0.7098, 0.2784, 0.0314); // #B54708 — Low Stock values
const DANGER = rgb(0.7059, 0.1373, 0.0941); // #B42318 — Out of Stock values

const FOOTER_H = 28;
const CONTENT_BOTTOM = MARGIN + FOOTER_H;

interface ReportSection {
  /** Optional heading drawn above this table, e.g. "Line items" or "Releases". */
  title?: string;
  headers: string[];
  rows: string[][];
}

interface Kpi {
  label: string;
  value: string;
  /** "warn" tints the value #B54708 (Low Stock), "danger" tints #B42318 (Out of Stock). */
  tone?: "warn" | "danger";
}

export async function generateReportPdf(params: {
  title: string;
  summary: string;
  generatedAt: Date;
  /** Company profile for the letterhead; falls back to the product name. */
  company?: { name: string; warehouseLocation: string };
  /** Shown right-aligned in the letterhead (e.g. "STOCK REPORT"). Defaults to title, uppercased. */
  reportType?: string;
  /** Mono reference number under the report type, e.g. "RPT-000123". */
  refNo?: string;
  /** Meta strip — GENERATED is always filled in from generatedAt. */
  period?: string;
  preparedBy?: string;
  /** Optional KPI row under the meta strip, hairline-separated. */
  kpis?: Kpi[];
  /** Single-table reports pass headers/rows directly (back-compat with existing callers). */
  headers?: string[];
  rows?: string[][];
  /** Multi-table reports (e.g. items + fulfillment history) pass sections instead. */
  sections?: ReportSection[];
}): Promise<Uint8Array> {
  const { title, summary, generatedAt, company, period, preparedBy, kpis } = params;
  const sections: ReportSection[] =
    params.sections ?? [{ headers: params.headers ?? [], rows: params.rows ?? [] }];
  const reportType = (params.reportType ?? title).toUpperCase();
  const companyName = company?.name ?? "DRIM Inventory System";

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const dMark = await embedDMark(pdfDoc);

  const pages: PDFPage[] = [];
  const newPage = () => {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    return page;
  };

  let page = newPage();
  let y = drawLetterhead(page, { font, boldFont, dMark, companyName, company, reportType, refNo: params.refNo });

  // Title + summary — bounded to the page's content width so a long
  // caller-supplied title (e.g. an MRF summary line concatenating project/
  // technician/status) can't run past the right margin off the printable
  // page instead of wrapping or truncating.
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  page.drawText(truncateToWidth(title, boldFont, 23, contentWidth), { x: MARGIN, y, size: 23, font: boldFont, color: INK });
  y -= 20;
  page.drawText(truncateToWidth(summary, font, 10, contentWidth), { x: MARGIN, y, size: 10, font, color: MUTED });
  y -= 16;

  // Meta strip: GENERATED / PERIOD / PREPARED BY / WAREHOUSE, between hairlines.
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: HAIRLINE });
  y -= 14;
  const metaCols: [string, string][] = [
    ["GENERATED", generatedAt.toLocaleString("en-PH")],
    ...(period ? ([["PERIOD", period]] as [string, string][]) : []),
    ...(preparedBy ? ([["PREPARED BY", preparedBy]] as [string, string][]) : []),
    ...(company?.warehouseLocation ? ([["WAREHOUSE", company.warehouseLocation]] as [string, string][]) : []),
  ];
  const metaColWidth = (PAGE_WIDTH - MARGIN * 2) / metaCols.length;
  metaCols.forEach(([label, value], i) => {
    const x = MARGIN + i * metaColWidth;
    page.drawText(label, { x, y, size: 8.5, font: boldFont, color: MUTED2 });
    // Leave a real gutter (not just 6pt) between meta columns — with up to
    // 4 columns on a 532pt content width, each is only ~133pt, and a value
    // like a full warehouse address needs room to actually be legible after
    // truncation rather than being cut to 3-4 words.
    page.drawText(truncateToWidth(value, boldFont, 9.5, metaColWidth - 14), {
      x,
      y: y - 12,
      size: 9.5,
      font: boldFont,
      color: INK,
    });
  });
  y -= 30;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: HAIRLINE });
  y -= 18;

  // KPI row, hairline column separators.
  if (kpis && kpis.length > 0) {
    const kpiColWidth = (PAGE_WIDTH - MARGIN * 2) / kpis.length;
    kpis.forEach((kpi, i) => {
      const x = MARGIN + i * kpiColWidth;
      if (i > 0) {
        page.drawLine({ start: { x, y: y + 14 }, end: { x, y: y - 18 }, thickness: 0.75, color: HAIRLINE });
      }
      const tx = x + (i > 0 ? 10 : 0);
      const colAvailable = kpiColWidth - (i > 0 ? 16 : 6);
      page.drawText(truncateToWidth(kpi.label.toUpperCase(), boldFont, 8, colAvailable), {
        x: tx,
        y,
        size: 8,
        font: boldFont,
        color: MUTED2,
      });
      const valueColor = kpi.tone === "danger" ? DANGER : kpi.tone === "warn" ? WARN : INK;
      page.drawText(truncateToWidth(kpi.value, boldFont, 16, colAvailable), {
        x: tx,
        y: y - 16,
        size: 16,
        font: boldFont,
        color: valueColor,
      });
    });
    y -= 42;
  }

  for (const section of sections) {
    if (section.title) {
      if (y < CONTENT_BOTTOM + ROW_HEIGHT * 2) {
        page = newPage();
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(section.title, { x: MARGIN, y, size: 11, font: boldFont, color: INK });
      y -= 18;
    }

    const colWidth = (PAGE_WIDTH - MARGIN * 2) / Math.max(1, section.headers.length);

    const drawHeaderRow = (yPos: number) => {
      section.headers.forEach((h, i) => {
        page.drawText(truncateToWidth(h.toUpperCase(), boldFont, 8.5, colWidth - 6), {
          x: MARGIN + i * colWidth,
          y: yPos,
          size: 8.5,
          font: boldFont,
          color: MUTED,
        });
      });
      page.drawLine({
        start: { x: MARGIN, y: yPos - 5 },
        end: { x: PAGE_WIDTH - MARGIN, y: yPos - 5 },
        thickness: 1.5,
        color: RULE_DARK,
      });
    };

    drawHeaderRow(y);
    y -= ROW_HEIGHT;

    for (const row of section.rows) {
      if (y < CONTENT_BOTTOM + ROW_HEIGHT) {
        page = newPage();
        y = PAGE_HEIGHT - MARGIN;
        drawHeaderRow(y);
        y -= ROW_HEIGHT;
      }
      row.forEach((cell, i) => {
        // Reserve a small gutter so adjacent columns never touch even at
        // the truncation boundary.
        const available = colWidth - 6;
        page.drawText(truncateToWidth(cell, font, 10.5, available), {
          x: MARGIN + i * colWidth,
          y,
          size: 10.5,
          font,
          color: INK,
        });
      });
      page.drawLine({
        start: { x: MARGIN, y: y - 4 },
        end: { x: PAGE_WIDTH - MARGIN, y: y - 4 },
        thickness: 0.5,
        color: HAIRLINE,
      });
      y -= ROW_HEIGHT;
    }

    if (section.rows.length === 0) {
      page.drawText("No data in the selected range.", {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: MUTED,
      });
      y -= ROW_HEIGHT;
    }

    y -= 10; // gap before next section
  }

  // Footnote + signature rules on the last page.
  if (y < CONTENT_BOTTOM + 70) {
    page = newPage();
    y = PAGE_HEIGHT - MARGIN;
  }
  y -= 8;
  page.drawText(
    "This report reflects DRIM Inventory System records at the time of generation and is not a substitute for a physical stock count.",
    { x: MARGIN, y, size: 9, font, color: MUTED }
  );
  y -= 34;
  const sigWidth = (PAGE_WIDTH - MARGIN * 2 - 40) / 3;
  ["Prepared by", "Checked by", "Approved by"].forEach((label, i) => {
    const x = MARGIN + i * (sigWidth + 20);
    page.drawLine({ start: { x, y }, end: { x: x + sigWidth, y }, thickness: 0.75, color: MUTED2 });
    page.drawText(label, { x, y: y - 12, size: 8.5, font, color: MUTED });
  });

  // Repeating footer + letterhead rule on every page (letterhead only repeats
  // past page 1; the footer stamp repeats on all pages).
  pages.forEach((p, i) => {
    if (i > 0) {
      drawLetterhead(p, { font, boldFont, dMark, companyName, company, reportType, refNo: params.refNo });
    }
    drawFooter(p, font, generatedAt, i + 1, pages.length);
  });

  return pdfDoc.save();
}

async function embedDMark(pdfDoc: PDFDocument) {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public/images/drim-d-transparent.png"));
    return await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

function drawLetterhead(
  page: PDFPage,
  opts: {
    font: PDFFont;
    boldFont: PDFFont;
    dMark: Awaited<ReturnType<typeof embedDMark>>;
    companyName: string;
    company?: { name: string; warehouseLocation: string };
    reportType: string;
    refNo?: string;
  }
): number {
  const { font, boldFont, dMark, companyName, company, reportType, refNo } = opts;
  let y = PAGE_HEIGHT - MARGIN;
  const markSize = 26;

  if (dMark) {
    const scale = markSize / dMark.height;
    page.drawImage(dMark, {
      x: MARGIN,
      y: y - markSize,
      width: dMark.width * scale,
      height: markSize,
    });
  }

  const textX = dMark ? MARGIN + markSize + 10 : MARGIN;

  // Reserve the right side's actual width first (report type + ref no, each
  // right-aligned against the margin) so the left side's company name/
  // address — which can be arbitrary user-entered text — never grows into
  // it. Both sides used to be measured independently against the page edge
  // only, so a long company name and the right-aligned report type/ref
  // could visually collide in the middle with no gutter between them.
  const typeWidth = boldFont.widthOfTextAtSize(reportType, 9);
  const refWidth = refNo ? boldFont.widthOfTextAtSize(refNo, 9) : 0;
  const rightSideWidth = Math.max(typeWidth, refWidth);
  const rightSideGutter = 16;
  const leftSideAvailable = PAGE_WIDTH - MARGIN - textX - rightSideWidth - rightSideGutter;

  page.drawText(truncateToWidth(companyName, boldFont, 11, leftSideAvailable), {
    x: textX,
    y: y - 10,
    size: 11,
    font: boldFont,
    color: INK,
  });
  if (company?.warehouseLocation) {
    page.drawText(truncateToWidth(company.warehouseLocation, font, 8.5, leftSideAvailable), {
      x: textX,
      y: y - 22,
      size: 8.5,
      font,
      color: MUTED,
    });
  }

  // Right-aligned report type + mono ref no.
  page.drawText(reportType, {
    x: PAGE_WIDTH - MARGIN - typeWidth,
    y: y - 10,
    size: 9,
    font: boldFont,
    color: MUTED,
  });
  if (refNo) {
    page.drawText(refNo, {
      x: PAGE_WIDTH - MARGIN - refWidth,
      y: y - 22,
      size: 9,
      font: boldFont,
      color: ACCENT,
    });
  }

  y -= markSize + 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 2, color: ACCENT });
  y -= 22;
  return y;
}

function drawFooter(page: PDFPage, font: PDFFont, generatedAt: Date, pageNum: number, pageCount: number) {
  const y = MARGIN - 12;
  page.drawLine({ start: { x: MARGIN, y: y + 14 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 14 }, thickness: 0.5, color: HAIRLINE });
  page.drawText(`Generated ${generatedAt.toLocaleString("en-PH")} · Internal use only`, {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: MUTED2,
  });
  const pageLabel = `Page ${pageNum} of ${pageCount}`;
  const pageLabelWidth = font.widthOfTextAtSize(pageLabel, 8);
  page.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - pageLabelWidth, y, size: 8, font, color: MUTED2 });
}

/** Truncates `value` with an ellipsis so it never exceeds `maxWidth` at the
 * given font/size — the actual fix for text overrunning its column. Binary
 * search on visible character count rather than a fixed cap, so it scales
 * correctly whether the column is 500pt wide (2-column meta strip) or 70pt
 * (a 7-column table's last field). */
function truncateToWidth(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;

  const ellipsis = "…";
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size);
  if (ellipsisWidth > maxWidth) return ""; // pathologically narrow column

  let lo = 0;
  let hi = value.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidateWidth = font.widthOfTextAtSize(value.slice(0, mid), size) + ellipsisWidth;
    if (candidateWidth <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? ellipsis : value.slice(0, lo) + ellipsis;
}
