import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [unreadCount, rows] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        refNo: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    unreadCount,
    items: rows.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    })),
  });
}

const patchSchema = z.object({
  action: z.enum(["markRead", "markAllRead"]),
  id: z.string().min(1).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, patchSchema);
  if ("error" in parsed) return parsed.error;

  const userId = session.user.id;

  if (parsed.data.action === "markAllRead") {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (!parsed.data.id) {
    return NextResponse.json({ error: "Notification id is required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id: parsed.data.id, userId },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
