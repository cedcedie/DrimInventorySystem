import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const ROW_HEIGHT = 16;

export async function generateReportPdf(params: {
  title: string;
  summary: string;
  headers: string[];
  rows: string[][];
  generatedAt: Date;
}): Promise<Uint8Array> {
  const { title, summary, headers, rows, generatedAt } = params;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText("DRIM Inventory System", { x: MARGIN, y, size: 9, font, color: rgb(0.55, 0.6, 0.65) });
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

  const colWidth = (PAGE_WIDTH - MARGIN * 2) / headers.length;

  const drawHeaderRow = (yPos: number) => {
    headers.forEach((h, i) => {
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

  for (const row of rows) {
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

  if (rows.length === 0) {
    page.drawText("No data in the selected range.", {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: rgb(0.55, 0.6, 0.65),
    });
  }

  return pdfDoc.save();
}
