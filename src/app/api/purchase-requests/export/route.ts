import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getPurchaseRequestsExportRows } from "@/lib/data/purchaseRequests";
import { generateQuickExport, summarizeFilters, type QuickExportFormat } from "@/lib/quickExport";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("purchaseRequests", "canExport");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") === "excel" ? "excel" : "pdf") as QuickExportFormat;
  const filters = {
    refNo: searchParams.get("refNo") ?? undefined,
    supplier: searchParams.get("supplier") ?? undefined,
    item: searchParams.get("item") ?? undefined,
    filedBy: searchParams.get("filedBy") ?? undefined,
  };

  try {
    const { headers, rows } = await getPurchaseRequestsExportRows(filters);
    const { bytes, contentType, extension } = await generateQuickExport({
      title: "Purchase Requests",
      headers,
      rows,
      format,
      filterSummary: summarizeFilters([
        ["Request #", filters.refNo],
        ["Supplier", filters.supplier],
        ["Item", filters.item],
        ["Filed By", filters.filedBy],
      ]),
      generatedBy: auth.session.user.name ?? auth.session.user.username ?? "Unknown",
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="purchase-requests-${Date.now()}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
