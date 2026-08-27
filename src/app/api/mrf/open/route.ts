import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getOpenMrfsQueue } from "@/lib/data/mrf";

/** Warehouse queue — open material requests awaiting fulfillment. */
export async function GET(req: Request) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "1");
  const q = searchParams.get("q") ?? "";
  return NextResponse.json(await getOpenMrfsQueue(page, q));
}
