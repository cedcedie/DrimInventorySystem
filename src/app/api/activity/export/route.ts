import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getActivityExportRows } from "@/lib/data/activity";
import { generateQuickExport, summarizeFilters, type QuickExportFormat } from "@/lib/quickExport";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("activity");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") === "excel" ? "excel" : "pdf") as QuickExportFormat;
  const filters = {
    user: searchParams.get("user") ?? undefined,
    action: searchParams.get("action") ?? undefined,
    ref: searchParams.get("ref") ?? undefined,
  };

  try {
    const { headers, rows } = await getActivityExportRows(auth.role, filters);
    const { bytes, contentType, extension } = await generateQuickExport({
      title: "Activity Log",
      headers,
      rows,
      format,
      filterSummary: summarizeFilters([
        ["User", filters.user],
        ["Action", filters.action],
        ["Reference", filters.ref],
      ]),
      generatedBy: auth.session.user.name ?? auth.session.user.username ?? "Unknown",
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="activity-log-${Date.now()}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
