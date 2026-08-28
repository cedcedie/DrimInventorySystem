import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getProductsExportRows } from "@/lib/data/products";
import { generateQuickExport, summarizeFilters, type QuickExportFormat } from "@/lib/quickExport";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("products", "canExport");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") === "excel" ? "excel" : "pdf") as QuickExportFormat;
  const filters = {
    code: searchParams.get("code") ?? undefined,
    name: searchParams.get("name") ?? undefined,
    supplier: searchParams.get("supplier") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  };

  try {
    const { headers, rows, truncated } = await getProductsExportRows(filters);
    const { bytes, contentType, extension } = await generateQuickExport({
      title: "Products",
      headers,
      rows,
      format,
      filterSummary: summarizeFilters([
        ["Code", filters.code],
        ["Product Name", filters.name],
        ["Supplier", filters.supplier],
        ["Category", filters.category && filters.category !== "All" ? filters.category : undefined],
      ]),
      generatedBy: auth.session.user.name ?? auth.session.user.username ?? "Unknown",
      truncated,
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="products-${Date.now()}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
