import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { buildReportData, type ReportType } from "@/lib/data/reports";
import { getCompanySettings } from "@/lib/data/settings";
import { generateReportPdf } from "@/lib/pdfReport";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { reportExportSchema } from "@/lib/schemas";

async function nextReportRefNo(): Promise<string> {
  const latest = await prisma.activityLog.findFirst({
    where: { refNo: { startsWith: "RPT-" } },
    orderBy: { refNo: "desc" },
  });
  const latestNum = latest ? parseInt(latest.refNo.split("-")[1] ?? "0", 10) : 0;
  const nextNum = (Number.isFinite(latestNum) ? latestNum : 0) + 1;
  return `RPT-${String(nextNum).padStart(3, "0")}`;
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("reports");
  if ("error" in auth) return auth.error;
  if (auth.role !== "ADMIN" && auth.role !== "OWNER") {
    return NextResponse.json({ error: "Generate Report requires Admin role" }, { status: 403 });
  }

  const parsed = await parseBody(req, reportExportSchema);
  if ("error" in parsed) return parsed.error;
  const { from: fromStr, to: toStr } = parsed.data;
  const type = parsed.data.type as ReportType;

  const from = new Date(fromStr);
  const to = new Date(toStr);
  to.setHours(23, 59, 59, 999);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const [{ headers, rows, summary }, company] = await Promise.all([
    buildReportData(type, from, to),
    getCompanySettings(),
  ]);
  const generatedAt = new Date();

  const pdfBytes = await generateReportPdf({
    title: type,
    summary,
    headers,
    rows,
    generatedAt,
    company,
  });

  const refNo = await nextReportRefNo();

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

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${refNo}.pdf"`,
        "Content-Length": String(pdfBytes.length),
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
