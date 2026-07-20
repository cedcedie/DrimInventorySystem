import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getUsersData } from "@/lib/data/users";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["OWNER", "ADMIN", "WAREHOUSE_STAFF", "TECHNICIAN"];

export async function GET(req: Request) {
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await getUsersData({ page: Number(searchParams.get("page") ?? "1") });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  // Only OWNER has "users" in MODULE_ACCESS, so reaching here already implies Owner.
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(`create-user:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
  }

  const body = await req.json();
  const name = (body.name ?? "").trim();
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  const role = body.role as Role;

  if (!name || !username || !password || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Name, username, password, and a valid role are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

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
