import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { passwordResetSchema } from "@/lib/schemas";

// Owner/Admin sets a new password for a user who forgot theirs — no current-
// password check, unlike /api/me/password's self-service flow. Restricted to
// Owner/Admin regardless of the users.canEdit matrix, since resetting
// someone else's credentials is more sensitive than editing their name/role.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("users", "canEdit");
  if ("error" in auth) return auth.error;
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json({ error: "Only Owner/Admin can reset another user's password" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = await parseBody(req, passwordResetSchema);
  if ("error" in parsed) return parsed.error;
  const { newPassword } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash } });
    await tx.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: `Reset password for account ${target.username}`,
        refNo: target.username,
        sensitive: true,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
