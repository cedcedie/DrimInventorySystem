import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

// Colors mirror src/theme/tokens.ts's light palette; pdf-lib can't import the TS module,
// so they're restated as rgb() literals — keep in sync by hand.
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
  /** Relative width per column (e.g. [1, 2.5, 1.5, 1, 1] — same idea as the
   * app's own CSS grid `fr` columns). Omit for an equal split. A short code
   * or a number needs far less room than a product name; splitting evenly
   * starved long values into truncation even after shrinking to an
   * unreadable size, which a wider column fixes at no cost to the short
   * ones. Length must match headers.length or it's ignored. */
  columnWeights?: number[];
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

  // Bounded to content width so a long caller-supplied title can't run past the margin.
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  page.drawText(truncateToWidth(title, boldFont, 23, contentWidth), { x: MARGIN, y, size: 23, font: boldFont, color: INK });
  y -= 20;
  // Wraps rather than truncates — the summary is often a caveat about what
  // the report does/doesn't cover, not something safe to cut mid-sentence.
  const summaryLines = wrapText(summary, font, 10, contentWidth);
  for (const line of summaryLines) {
    page.drawText(line, { x: MARGIN, y, size: 10, font, color: MUTED });
    y -= 13;
  }
  y -= 3;

  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: HAIRLINE });
  y -= 14;
  // GENERATED / PERIOD / PREPARED BY are always short (a date, a date range, a
  // name) — a 3-column strip fits them comfortably. WAREHOUSE is a full postal
  // address and needs real width: even shrunk to an unreadable ~5pt it barely
  // fit a 4th column here, so it gets its own full-width row below instead —
  // full-size font, no shrinking, nothing left to truncate.
  const metaCols: [string, string][] = [
    ["GENERATED", generatedAt.toLocaleString("en-PH")],
    ...(period ? ([["PERIOD", period]] as [string, string][]) : []),
    ...(preparedBy ? ([["PREPARED BY", preparedBy]] as [string, string][]) : []),
  ];
  const metaColWidth = (PAGE_WIDTH - MARGIN * 2) / metaCols.length;
  metaCols.forEach(([label, value], i) => {
    const x = MARGIN + i * metaColWidth;
    page.drawText(label, { x, y, size: 8.5, font: boldFont, color: MUTED2 });
    const fitted = fitTextToWidth(value, boldFont, 9.5, metaColWidth - 14);
    page.drawText(fitted.text, {
      x,
      y: y - 12,
      size: fitted.size,
      font: boldFont,
      color: INK,
    });
  });
  y -= 30;

  if (company?.warehouseLocation) {
    page.drawText("WAREHOUSE", { x: MARGIN, y, size: 8.5, font: boldFont, color: MUTED2 });
    page.drawText(toWinAnsiSafe(company.warehouseLocation), {
      x: MARGIN,
      y: y - 12,
      size: 9.5,
      font: boldFont,
      color: INK,
    });
    y -= 30;
  }

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: HAIRLINE });
  y -= 18;

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

    // Equal split unless the caller supplies weights (e.g. [1, 2.5, 1.5, ...]
    // — same idea as the app's own CSS grid `fr` columns) sized to what each
    // column actually holds. A flat equal split starved long values (product
    // names, addresses) into truncation even after shrinking to unreadable
    // sizes; wider columns for the columns that need it fixes that for free.
    const contentWidth = PAGE_WIDTH - MARGIN * 2;
    const weights =
      section.columnWeights?.length === section.headers.length
        ? section.columnWeights
        : section.headers.map(() => 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const colWidths = weights.map((w) => (contentWidth * w) / weightSum);
    const colX = colWidths.reduce<number[]>((acc, w, i) => {
      acc.push(i === 0 ? MARGIN : acc[i - 1] + colWidths[i - 1]);
      return acc;
    }, []);

    const drawHeaderRow = (yPos: number) => {
      section.headers.forEach((h, i) => {
        // Shrinks like body cells rather than hard-truncating — a header like
        // "NET MOVEMENT" or "REQUESTED" is short enough to usually fit as-is,
        // but the tightest numeric columns (sized for a 4-digit number, not
        // their own label) need a little headroom the same way body text does.
        const fittedHeader = fitTextToWidth(h.toUpperCase(), boldFont, 8.5, colWidths[i] - 6, 6.5);
        page.drawText(fittedHeader.text, {
          x: colX[i],
          y: yPos,
          size: fittedHeader.size,
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
        // Small gutter so adjacent columns never touch. Shrinks to fit
        // instead of truncating — table values (names, addresses) must stay
        // fully readable rather than being cut to "…".
        const available = colWidths[i] - 6;
        const fitted = fitTextToWidth(cell, font, 10.5, available);
        page.drawText(fitted.text, {
          x: colX[i],
          y,
          size: fitted.size,
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

    y -= 10;
  }

  let closingPageHasLetterhead = false;
  if (y < CONTENT_BOTTOM + 70) {
    page = newPage();
    // Draw this new page's letterhead immediately — the disclaimer/signature
    // block below shares this same page and must not be placed at the raw
    // top-of-page y, or it lands under the letterhead once that's drawn in
    // the loop below (they'd overlap: both start from PAGE_HEIGHT - MARGIN).
    y = drawLetterhead(page, { font, boldFont, dMark, companyName, company, reportType, refNo: params.refNo });
    closingPageHasLetterhead = true;
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

  // Letterhead repeats on every page after the first — except the closing
  // page above, if it already got one from the disclaimer's own page-break.
  const lastPageIndex = pages.length - 1;
  pages.forEach((p, i) => {
    if (i > 0 && !(i === lastPageIndex && closingPageHasLetterhead)) {
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

  // Measure the right side (report type + ref no) first so the left side's arbitrary
  // company name/address can't grow into it — previously both were measured independently
  // and could collide in the middle.
  const safeReportType = toWinAnsiSafe(reportType);
  const safeRefNo = refNo ? toWinAnsiSafe(refNo) : undefined;
  const typeWidth = boldFont.widthOfTextAtSize(safeReportType, 9);
  const refWidth = safeRefNo ? boldFont.widthOfTextAtSize(safeRefNo, 9) : 0;
  const rightSideWidth = Math.max(typeWidth, refWidth);
  const rightSideGutter = 16;
  const leftSideAvailable = PAGE_WIDTH - MARGIN - textX - rightSideWidth - rightSideGutter;

  const fittedName = fitTextToWidth(companyName, boldFont, 11, leftSideAvailable);
  page.drawText(fittedName.text, {
    x: textX,
    y: y - 10,
    size: fittedName.size,
    font: boldFont,
    color: INK,
  });
  if (company?.warehouseLocation) {
    const fittedAddr = fitTextToWidth(company.warehouseLocation, font, 8.5, leftSideAvailable);
    page.drawText(fittedAddr.text, {
      x: textX,
      y: y - 22,
      size: fittedAddr.size,
      font,
      color: MUTED,
    });
  }

  page.drawText(safeReportType, {
    x: PAGE_WIDTH - MARGIN - typeWidth,
    y: y - 10,
    size: 9,
    font: boldFont,
    color: MUTED,
  });
  if (safeRefNo) {
    page.drawText(safeRefNo, {
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

// pdf-lib's standard fonts use WinAnsi encoding, which can't render every
// Unicode character a caller might type into a report title/summary/label —
// the true minus sign (U+2212) is the one that's actually bitten us (a
// hyphen "-" looks identical and works fine). Rather than hope every string
// a report ever produces stays within WinAnsi, map the couple of common
// look-alikes and drop anything else outside Latin-1 — better a dropped
// character than a 500 on the whole export.
const WINANSI_SAFE_REPLACEMENTS: Record<string, string> = {
  "−": "-", // − minus sign → hyphen
  "‘": "'", // ' left single quote
  "’": "'", // ' right single quote
  "“": '"', // " left double quote
  "”": '"', // " right double quote
};
function toWinAnsiSafe(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch in WINANSI_SAFE_REPLACEMENTS) {
      out += WINANSI_SAFE_REPLACEMENTS[ch];
    } else if (ch.codePointAt(0)! <= 0xff) {
      out += ch;
    }
    // else: drop — outside WinAnsi's range and not one of the known look-alikes.
  }
  return out;
}

/** Greedy word-wrap into as many lines as needed to fit maxWidth — used for
 * the summary line, which can be a full explanatory sentence (a report's own
 * caveat about what it does/doesn't cover) that must stay intact rather than
 * being cut to "…" partway through. */
function wrapText(rawValue: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const value = toWinAnsiSafe(rawValue);
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Binary search on visible character count so it scales from a 500pt meta strip
 * column down to a 70pt table field. */
function truncateToWidth(rawValue: string, font: PDFFont, size: number, maxWidth: number): string {
  const value = toWinAnsiSafe(rawValue);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;

  const ellipsis = "…";
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size);
  if (ellipsisWidth > maxWidth) return "";

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

/** Shrinks font size (down to a floor) so the full string fits with no "…" —
 * used for table/meta cells where every character must stay legible rather
 * than being cut off. Falls back to truncateToWidth only if even the floor
 * size doesn't fit (pathologically long values). */
function fitTextToWidth(
  rawValue: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  minSize = 7
): { text: string; size: number } {
  const value = toWinAnsiSafe(rawValue);
  let s = size;
  while (s > minSize && font.widthOfTextAtSize(value, s) > maxWidth) {
    s -= 0.5;
  }
  if (font.widthOfTextAtSize(value, s) <= maxWidth) {
    return { text: value, size: s };
  }
  return { text: truncateToWidth(value, font, s, maxWidth), size: s };
}
