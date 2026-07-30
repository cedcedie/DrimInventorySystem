import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { passwordChangeSchema } from "@/lib/schemas";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Changing your own password is not a module-gated action — every role can do
// it for their own account, so this authenticates directly rather than going
// through requireModuleAccess().
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Throttled harder than ordinary mutations: this endpoint verifies a
  // password, so it's an oracle for guessing the current one.
  const rl = checkRateLimit(`change-password:${getClientIp(req)}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const parsed = await parseBody(req, passwordChangeSchema);
  if ("error" in parsed) return parsed.error;
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const currentIsValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentIsValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "Changed own account password",
        refNo: user.username,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
