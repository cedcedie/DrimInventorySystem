import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getAdjustmentsExportRows } from "@/lib/data/adjustments";
import { generateQuickExport, summarizeFilters, type QuickExportFormat } from "@/lib/quickExport";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("inventory", "canExport");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") === "excel" ? "excel" : "pdf") as QuickExportFormat;
  const filters = {
    refNo: searchParams.get("refNo") ?? undefined,
    product: searchParams.get("product") ?? undefined,
    note: searchParams.get("note") ?? undefined,
    user: searchParams.get("user") ?? undefined,
  };

  try {
    const { headers, rows, truncated } = await getAdjustmentsExportRows(filters);
    const { bytes, contentType, extension } = await generateQuickExport({
      title: "Stock Adjustments",
      headers,
      rows,
      format,
      filterSummary: summarizeFilters([
        ["Adj. #", filters.refNo],
        ["Product", filters.product],
        ["Note", filters.note],
        ["By", filters.user],
      ]),
      generatedBy: auth.session.user.name ?? auth.session.user.username ?? "Unknown",
      truncated,
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="stock-adjustments-${Date.now()}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
