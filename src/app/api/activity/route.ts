import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getActivityData } from "@/lib/data/activity";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("activity");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getActivityData({
    page: Number(searchParams.get("page") ?? "1"),
    role: auth.role,
    user: searchParams.get("user") ?? undefined,
    action: searchParams.get("action") ?? undefined,
    ref: searchParams.get("ref") ?? undefined,
  });

  return NextResponse.json(data);
}
