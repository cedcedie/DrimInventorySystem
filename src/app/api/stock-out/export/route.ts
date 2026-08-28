import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockOutExportRows } from "@/lib/data/stock";
import { generateQuickExport, summarizeFilters, type QuickExportFormat } from "@/lib/quickExport";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock", "canExport");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") === "excel" ? "excel" : "pdf") as QuickExportFormat;
  const filters = {
    mrfNumber: searchParams.get("mrfNumber") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    item: searchParams.get("item") ?? undefined,
    project: searchParams.get("project") ?? undefined,
    technician: searchParams.get("technician") ?? undefined,
  };

  try {
    const { headers, rows, truncated } = await getStockOutExportRows(filters);
    const { bytes, contentType, extension } = await generateQuickExport({
      title: "Stock Out — Release Slips",
      headers,
      rows,
      format,
      filterSummary: summarizeFilters([
        ["MRF #", filters.mrfNumber],
        ["Date", filters.date],
        ["Item", filters.item],
        ["Project", filters.project],
        ["Technician", filters.technician],
      ]),
      generatedBy: auth.session.user.name ?? auth.session.user.username ?? "Unknown",
      truncated,
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="stock-out-${Date.now()}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
