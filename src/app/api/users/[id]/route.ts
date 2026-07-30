import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { userUpdateSchema } from "@/lib/schemas";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Only OWNER has "users" in MODULE_ACCESS, so reaching here implies Owner.
  const auth = await requireModuleAccess("users");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = await parseBody(req, userUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { name, role, status } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Guard against an Owner locking everyone out of the Users module by
  // demoting or deactivating the last active Owner.
  const losingOwnerAccess = target.role === "OWNER" && (role !== "OWNER" || status !== "ACTIVE");
  if (losingOwnerAccess) {
    const otherActiveOwners = await prisma.user.count({
      where: { role: "OWNER", status: "ACTIVE", id: { not: id } },
    });
    if (otherActiveOwners === 0) {
      return NextResponse.json(
        { error: "This is the last active Owner — promote another Owner first" },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { name, role, status },
      });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Updated account ${user.username} — ${user.role}, ${user.status}`,
          refNo: user.username,
        },
      });
      return user;
    });

    revalidateAfterMutation(["users"]);
    return NextResponse.json({ id: updated.id });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }
    throw e;
  }
}
