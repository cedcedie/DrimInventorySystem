import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { categoryCreateSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const auth = await requireModuleAccess("products");
  if ("error" in auth) return auth.error;
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json({ error: "Only Owner or Admin can add categories" }, { status: 403 });
  }

  const parsed = await parseBody(req, categoryCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { name } = parsed.data;

  try {
    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.category.create({ data: { name } });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Added category "${created.name}"`,
          refNo: created.id,
        },
      });
      return created;
    });

    revalidateAfterMutation(["products", "inventory"]);
    return NextResponse.json({ id: category.id, name: category.name }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Category already exists" }, { status: 409 });
    }
    throw e;
  }
}
