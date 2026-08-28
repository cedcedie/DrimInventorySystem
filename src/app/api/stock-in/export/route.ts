import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockInExportRows } from "@/lib/data/stock";
import { generateQuickExport, summarizeFilters, type QuickExportFormat } from "@/lib/quickExport";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock", "canExport");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") === "excel" ? "excel" : "pdf") as QuickExportFormat;
  const filters = {
    item: searchParams.get("item") ?? undefined,
    supplier: searchParams.get("supplier") ?? undefined,
    refNo: searchParams.get("refNo") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    receivedBy: searchParams.get("receivedBy") ?? undefined,
  };

  try {
    const { headers, rows, truncated } = await getStockInExportRows(filters);
    const { bytes, contentType, extension } = await generateQuickExport({
      title: "Stock In — Receipt Slips",
      headers,
      rows,
      format,
      filterSummary: summarizeFilters([
        ["Receipt #", filters.refNo],
        ["Date", filters.date],
        ["Supplier", filters.supplier],
        ["Item", filters.item],
        ["Received By", filters.receivedBy],
      ]),
      generatedBy: auth.session.user.name ?? auth.session.user.username ?? "Unknown",
      truncated,
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="stock-in-${Date.now()}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
