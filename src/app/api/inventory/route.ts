import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getInventoryData } from "@/lib/data/inventory";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("inventory");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getInventoryData({
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    page: Number(searchParams.get("page") ?? "1"),
  });

  return NextResponse.json(data);
}
