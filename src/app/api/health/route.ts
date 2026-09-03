import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Unauthenticated on purpose (see middleware.ts) — this is what an uptime
// monitor or Vercel's own checks hit to confirm the app AND its DB
// connection are actually up, not just that the edge is serving something.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("Health check failed:", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
