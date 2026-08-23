import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { userUpdateSchema } from "@/lib/schemas";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { uniqueConstraintResponse } from "@/lib/apiError";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("users", "canEdit");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = await parseBody(req, userUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { name, role, status } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent demoting/deactivating the last active Owner — would lock everyone out.
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
          sensitive: true,
        },
      });
      return user;
    });

    revalidateAfterMutation(["users"]);
    return NextResponse.json({ id: updated.id });
  } catch (e) {
    const conflict = uniqueConstraintResponse(e, "Username already exists");
    if (conflict) return conflict;
    throw e;
  }
}
