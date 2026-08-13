import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const ROW_HEIGHT = 16;

interface ReportSection {
  /** Optional heading drawn above this table, e.g. "Line items" or "Releases". */
  title?: string;
  headers: string[];
  rows: string[][];
}

export async function generateReportPdf(params: {
  title: string;
  summary: string;
  generatedAt: Date;
  /** Company profile for the letterhead; falls back to the product name. */
  company?: { name: string; warehouseLocation: string };
  /** Single-table reports pass headers/rows directly (back-compat with existing callers). */
  headers?: string[];
  rows?: string[][];
  /** Multi-table reports (e.g. items + fulfillment history) pass sections instead. */
  sections?: ReportSection[];
}): Promise<Uint8Array> {
  const { title, summary, generatedAt, company } = params;
  const sections: ReportSection[] =
    params.sections ?? [{ headers: params.headers ?? [], rows: params.rows ?? [] }];

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(company?.name ?? "DRIM Inventory System", {
    x: MARGIN,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.24, 0.28, 0.33),
  });
  if (company?.warehouseLocation) {
    y -= 11;
    page.drawText(company.warehouseLocation, {
      x: MARGIN,
      y,
      size: 8.5,
      font,
      color: rgb(0.55, 0.6, 0.65),
    });
  }
  y -= 20;
  page.drawText(title, { x: MARGIN, y, size: 18, font: boldFont, color: rgb(0.14, 0.16, 0.2) });
  y -= 16;
  page.drawText(summary, { x: MARGIN, y, size: 10, font, color: rgb(0.42, 0.46, 0.51) });
  y -= 14;
  page.drawText(`Generated ${generatedAt.toLocaleString("en-PH")}`, {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: rgb(0.55, 0.6, 0.65),
  });
  y -= 24;

  for (const section of sections) {
    if (section.title) {
      if (y < MARGIN + ROW_HEIGHT * 2) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(section.title, { x: MARGIN, y, size: 11, font: boldFont, color: rgb(0.14, 0.16, 0.2) });
      y -= 18;
    }

    const colWidth = (PAGE_WIDTH - MARGIN * 2) / Math.max(1, section.headers.length);

    const drawHeaderRow = (yPos: number) => {
      section.headers.forEach((h, i) => {
        page.drawText(h, {
          x: MARGIN + i * colWidth,
          y: yPos,
          size: 9,
          font: boldFont,
          color: rgb(0.14, 0.16, 0.2),
        });
      });
      page.drawLine({
        start: { x: MARGIN, y: yPos - 4 },
        end: { x: PAGE_WIDTH - MARGIN, y: yPos - 4 },
        thickness: 0.5,
        color: rgb(0.8, 0.82, 0.85),
      });
    };

    drawHeaderRow(y);
    y -= ROW_HEIGHT;

    for (const row of section.rows) {
      if (y < MARGIN + ROW_HEIGHT) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
        drawHeaderRow(y);
        y -= ROW_HEIGHT;
      }
      row.forEach((cell, i) => {
        const truncated = cell.length > 38 ? cell.slice(0, 35) + "…" : cell;
        page.drawText(truncated, {
          x: MARGIN + i * colWidth,
          y,
          size: 8.5,
          font,
          color: rgb(0.14, 0.16, 0.2),
        });
      });
      y -= ROW_HEIGHT;
    }

    if (section.rows.length === 0) {
      page.drawText("No data in the selected range.", {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: rgb(0.55, 0.6, 0.65),
      });
      y -= ROW_HEIGHT;
    }

    y -= 10; // gap before next section
  }

  return pdfDoc.save();
}
