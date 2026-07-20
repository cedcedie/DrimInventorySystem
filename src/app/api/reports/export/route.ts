import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { buildReportData, REPORT_TYPES, type ReportType } from "@/lib/data/reports";
import { generateReportPdf } from "@/lib/pdfReport";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import { revalidateAfterMutation } from "@/lib/revalidate";

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

  const body = await req.json();
  const type = body.type as ReportType;
  const fromStr = body.from as string;
  const toStr = body.to as string;

  if (!REPORT_TYPES.includes(type) || !fromStr || !toStr) {
    return NextResponse.json({ error: "Report type and date range are required" }, { status: 400 });
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);
  to.setHours(23, 59, 59, 999);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const { headers, rows, summary } = await buildReportData(type, from, to);
  const generatedAt = new Date();

  const pdfBytes = await generateReportPdf({
    title: type,
    summary,
    headers,
    rows,
    generatedAt,
  });

  const refNo = await nextReportRefNo();
  const key = `reports/${refNo}.pdf`;

  try {
    await uploadToR2(key, Buffer.from(pdfBytes), "application/pdf");
    const signedUrl = await getSignedR2Url(key);

    await prisma.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: `Generated ${type} (${from.toLocaleDateString("en-PH")}–${to.toLocaleDateString("en-PH")})`,
        refNo,
      },
    });

    revalidateAfterMutation([]);
    return NextResponse.json({ refNo, url: signedUrl, summary, rowCount: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Report export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
