import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";

/** Feeds the manual notification compose modal's recipient checkbox list —
 * every option renders at once (it's a multi-select, not a paged table), so
 * a hard cap rather than real pagination. Owner/Admin only, same gate as
 * sending itself. */
const MAX_RECIPIENTS_LISTED = 500;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as Role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
    take: MAX_RECIPIENTS_LISTED,
  });

  return NextResponse.json({ users });
}
