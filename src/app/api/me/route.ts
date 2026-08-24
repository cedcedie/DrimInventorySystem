import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { profileUpdateSchema } from "@/lib/schemas";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      status: true,
      avatarKey: true,
      createdAt: true,
      technician: { select: { empNo: true, position: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    createdAt: user.createdAt.toISOString(),
  });
}

// Self-service profile edit. Only `name` is mutable here — username is the
// identity key, and a self-editable role would be privilege escalation.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, profileUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { name } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: session.user.id },
      data: { name },
    });
    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: `Updated own display name to ${user.name}`,
        refNo: user.username,
      },
    });
    return user;
  });

  revalidateAfterMutation(["users"]);
  return NextResponse.json({ id: updated.id, name: updated.name });
}
