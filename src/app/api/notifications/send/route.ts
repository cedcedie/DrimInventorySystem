import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { manualNotificationSchema } from "@/lib/schemas";
import { sendManualNotification } from "@/lib/notifications";
import { revalidateAfterMutation } from "@/lib/revalidate";
import type { Role } from "@/generated/prisma";

/** Owner/Admin send a manual notification to hand-picked users and/or whole
 * roles. Not gated via the configurable permission matrix — this mirrors
 * the same static Owner+Admin gate the /api/permissions routes use, since a
 * "message anyone" capability is inherently an admin-tier action, not
 * something that should be independently grantable per role/user. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as Role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json(
      { error: "Sending notifications requires Owner or Admin" },
      { status: 403 }
    );
  }

  const parsed = await parseBody(req, manualNotificationSchema);
  if ("error" in parsed) return parsed.error;
  const { title, body, userIds, roles } = parsed.data;

  if (userIds.length === 0 && roles.length === 0) {
    return NextResponse.json({ error: "Pick at least one recipient" }, { status: 400 });
  }

  const roleRecipients =
    roles.length > 0
      ? await prisma.user.findMany({
          where: { role: { in: roles }, status: "ACTIVE" },
          select: { id: true },
        })
      : [];

  const recipientUserIds = [...new Set([...userIds, ...roleRecipients.map((u) => u.id)])];

  if (recipientUserIds.length === 0) {
    return NextResponse.json({ error: "No active accounts match the selected recipients" }, { status: 400 });
  }

  await sendManualNotification({
    recipientUserIds,
    senderUserId: session.user.id,
    title,
    body,
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: `Sent a notification to ${recipientUserIds.length} recipient(s) — "${title}"`,
      refNo: "NOTIFY",
      sensitive: true,
    },
  });

  revalidateAfterMutation([]);
  return NextResponse.json({ ok: true, recipientCount: recipientUserIds.length }, { status: 201 });
}
