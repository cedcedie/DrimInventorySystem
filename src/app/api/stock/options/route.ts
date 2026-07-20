import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getStockFormOptions } from "@/lib/data/stock";

export async function GET() {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  return NextResponse.json(await getStockFormOptions());
}
