import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { getInventoryData } from "@/lib/data/inventory";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("inventory");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getInventoryData({
    code: searchParams.get("code") ?? undefined,
    name: searchParams.get("name") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    page: Number(searchParams.get("page") ?? "1"),
  });

  // Unit cost / valuation is Owner/Admin-only — strip before it leaves the server.
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json({
      ...data,
      rows: data.rows.map((row) => {
        const { amount, total, ...rest } = row;
        void amount;
        void total;
        return rest;
      }),
    });
  }

  return NextResponse.json(data);
}
