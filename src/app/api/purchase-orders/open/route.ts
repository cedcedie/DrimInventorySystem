import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getOpenPurchaseOrdersForSupplier } from "@/lib/data/purchaseOrders";

/** Open (SENT / PARTIALLY_RECEIVED) POs for one supplier — feeds the
 * "Link to Purchase Order" picker in the Stock In modal. Gated on the stock
 * module (not purchaseOrders) since this is consumed from Stock In, which
 * Warehouse Staff already has canCreate on. */
export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplierId");
  if (!supplierId) {
    return NextResponse.json({ purchaseOrders: [] });
  }

  const purchaseOrders = await getOpenPurchaseOrdersForSupplier(supplierId);
  return NextResponse.json({ purchaseOrders });
}
