import { NextResponse } from "next/server";
import { requireModuleAccess, isOwnerOrAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function POST(req: Request) {
  const auth = await requireModuleAccess("products");
  if ("error" in auth) return auth.error;
  if (!isOwnerOrAdmin(auth.role)) {
    return NextResponse.json({ error: "Only Owner or Admin can add categories" }, { status: 403 });
  }

  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

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
