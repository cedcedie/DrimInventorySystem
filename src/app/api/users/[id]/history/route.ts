import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/apiAuth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const activities = await prisma.activityLog.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    rows: activities.map((a) => ({
      dt: a.createdAt.toISOString(),
      action: a.action,
      ref: a.refNo,
    })),
  });
}
