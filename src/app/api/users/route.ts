import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getUsersData } from "@/lib/data/users";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseBody } from "@/lib/validate";
import { userCreateSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getUsersData({ page: Number(searchParams.get("page") ?? "1") });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("users", "canCreate");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(`create-user:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
  }

  const parsed = await parseBody(req, userCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { name, username, password, role } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, username, passwordHash, role },
      });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Created user account for ${created.name}`,
          refNo: created.username,
          sensitive: true,
        },
      });
      return created;
    });

    revalidateAfterMutation(["users"]);
    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }
    throw e;
  }
}
