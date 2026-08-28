import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getOpenMrfsExportRows } from "@/lib/data/mrf";
import { generateQuickExport, summarizeFilters, type QuickExportFormat } from "@/lib/quickExport";

/** Warehouse queue export — same filters/access as the Open MRFs list. */
export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock", "canExport");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") === "excel" ? "excel" : "pdf") as QuickExportFormat;
  const filters = {
    mrfNumber: searchParams.get("mrfNumber") ?? undefined,
    project: searchParams.get("project") ?? undefined,
    item: searchParams.get("item") ?? undefined,
    technician: searchParams.get("technician") ?? undefined,
  };

  try {
    const { headers, rows } = await getOpenMrfsExportRows(filters);
    const { bytes, contentType, extension } = await generateQuickExport({
      title: "Open Material Requests",
      headers,
      rows,
      format,
      filterSummary: summarizeFilters([
        ["MRF #", filters.mrfNumber],
        ["Item", filters.item],
        ["Project", filters.project],
        ["Technician", filters.technician],
      ]),
      generatedBy: auth.session.user.name ?? auth.session.user.username ?? "Unknown",
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="open-mrfs-${Date.now()}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
