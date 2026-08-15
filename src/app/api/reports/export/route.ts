import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { buildReportData, type ReportType } from "@/lib/data/reports";
import { getCompanySettings } from "@/lib/data/settings";
import { generateReportPdf } from "@/lib/pdfReport";
import { generateExcelReport } from "@/lib/excelReport";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { reportExportSchema } from "@/lib/schemas";
import { nextActivityRefNo } from "@/lib/refNo";

export async function POST(req: Request) {
  const auth = await requireModuleAccess("reports", "canExport");
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(req, reportExportSchema);
  if ("error" in parsed) return parsed.error;
  const { from: fromStr, to: toStr, format = "pdf" } = parsed.data;
  const type = parsed.data.type as ReportType;

  const from = new Date(fromStr);
  const to = new Date(toStr);
  to.setHours(23, 59, 59, 999);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const includePricing = auth.role === "OWNER" || auth.role === "ADMIN";

  const [{ headers, rows, summary }, company, refNo] = await Promise.all([
    buildReportData(type, from, to, { includePricing }),
    getCompanySettings(),
    prisma.$transaction((tx) => nextActivityRefNo(tx, "RPT", 3)),
  ]);
  const generatedAt = new Date();
  const preparedBy = auth.session.user.name ?? auth.session.user.username ?? "Unknown";
  const period = `${from.toLocaleDateString("en-PH")} – ${to.toLocaleDateString("en-PH")}`;

  // Generate report in requested format
  const reportBytes = format === "excel"
    ? await generateExcelReport({
        type,
        from: from.toLocaleDateString("en-PH"),
        to: to.toLocaleDateString("en-PH"),
        headers,
        rows,
        summary,
        generatedBy: preparedBy,
        companyName: company.name,
        warehouseLocation: company.warehouseLocation,
      })
    : await generateReportPdf({
        title: type,
        summary,
        headers,
        rows,
        generatedAt,
        company,
        refNo,
        period,
        preparedBy,
      });

  const fileExtension = format === "excel" ? "xlsx" : "pdf";
  const contentType = format === "excel"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/pdf";

  try {
    // The PDF is a view over the database, not data in its own right — it can be
    // regenerated at any time. Streaming it straight to the browser avoids a
    // storage round-trip, expiring signed URLs, and orphaned files in a bucket.
    await prisma.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: `Generated ${type} (${from.toLocaleDateString("en-PH")}–${to.toLocaleDateString("en-PH")})`,
        refNo,
      },
    });

    revalidateAfterMutation([]);

    return new NextResponse(Buffer.from(reportBytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${refNo}.${fileExtension}"`,
        "Content-Length": String(reportBytes.length),
        // Report content reflects the data at generation time — never cache it.
        "Cache-Control": "no-store",
        // Surfaces the ref number and row count to the client without a second request.
        "X-Report-Ref": refNo,
        "X-Report-Rows": String(rows.length),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Report export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
