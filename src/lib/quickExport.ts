import { generateReportPdf } from "@/lib/pdfReport";
import { generateExcelReport } from "@/lib/excelReport";
import { getCompanySettings } from "@/lib/data/settings";

export type QuickExportFormat = "pdf" | "excel";

/** Consistent date formatting for exported table cells across every screen's export. */
export function formatDateForExport(d: Date): string {
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * "Download what I'm looking at" export for a screen's SEARCH BY-filtered
 * table — distinct from the formal date-ranged Reports feature (src/lib/data/reports.ts),
 * which this deliberately doesn't touch. Reuses the same branded PDF/Excel
 * generators so the output looks consistent with the rest of the app.
 */
export async function generateQuickExport(params: {
  /** Shown in the letterhead/worksheet title, e.g. "Stock Out — Release Slips". */
  title: string;
  headers: string[];
  rows: string[][];
  format: QuickExportFormat;
  /** One-line description of the active filters, e.g. "Item: pipe" or "All records". */
  filterSummary: string;
  generatedBy: string;
  /** True when the underlying query hit the export row cap — the file only has
   * a partial result, so the summary says so instead of quietly implying
   * `rows.length` is the whole match. */
  truncated?: boolean;
}): Promise<{ bytes: Buffer; contentType: string; extension: string }> {
  const { title, headers, rows, format, filterSummary, generatedBy, truncated } = params;
  const company = await getCompanySettings();
  const summary = truncated
    ? `Showing first ${rows.length.toLocaleString()} records — more match your search than fit in one file; narrow your search to get all of them`
    : `${rows.length} matching record${rows.length === 1 ? "" : "s"}`;

  if (format === "excel") {
    const bytes = await generateExcelReport({
      type: title,
      from: filterSummary,
      to: "",
      headers,
      rows,
      summary,
      generatedBy,
      companyName: company.name,
      warehouseLocation: company.warehouseLocation,
    });
    return {
      bytes: Buffer.from(bytes),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }

  const pdfBytes = await generateReportPdf({
    title,
    summary,
    generatedAt: new Date(),
    company,
    period: filterSummary,
    preparedBy: generatedBy,
    headers,
    rows,
  });
  return { bytes: Buffer.from(pdfBytes), contentType: "application/pdf", extension: "pdf" };
}

/** Turns the same filter object each screen already tracks into "Field: value · Field: value"
 * (or "All records" when nothing is filled in) for the exported file's meta line. */
export function summarizeFilters(labeled: Array<[label: string, value: string | undefined]>): string {
  const parts = labeled.filter(([, v]) => v && v.trim()).map(([label, v]) => `${label}: ${v}`);
  return parts.length ? parts.join(" · ") : "All records";
}
