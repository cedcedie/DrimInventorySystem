import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getSuppliersData } from "@/lib/data/suppliers";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { supplierCreateSchema } from "@/lib/schemas";

export async function GET() {
  const auth = await requireModuleAccess("suppliers");
  if ("error" in auth) return auth.error;

  return NextResponse.json(await getSuppliersData());
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("suppliers");
  if ("error" in auth) return auth.error;
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Only Owner can add suppliers" }, { status: 403 });
  }

  const parsed = await parseBody(req, supplierCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { name } = parsed.data;
  const contact = parsed.data.contact || "—";
  const supplies = parsed.data.supplies || "—";

  try {
    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({ data: { name, contact, supplies } });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Added supplier ${created.name} to registry`,
          refNo: created.id,
        },
      });
      return created;
    });

    revalidateAfterMutation(["suppliers"]);
    return NextResponse.json({ id: supplier.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Supplier already exists" }, { status: 409 });
    }
    throw e;
  }
}
