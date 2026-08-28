import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProductCatalog } from "@/lib/data/products";

/** Lightweight name/code/category list for the "Item" filter dropdowns across
 * search screens — any signed-in user can read it (it's just labels, not
 * stock levels or pricing), unlike the full Products/Inventory endpoints
 * which are gated per-module. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getProductCatalog());
}
