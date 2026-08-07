import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getTechnicianForUser, getMrfsForTechnician } from "@/lib/data/mrf";
import { prisma } from "@/lib/prisma";
import { nextRefNo } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { mrfCreateSchema } from "@/lib/schemas";

export async function GET() {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;
  if (auth.role !== "TECHNICIAN") {
    return NextResponse.json({ error: "Only technicians file MRFs" }, { status: 403 });
  }

  const technician = await getTechnicianForUser(auth.session.user.id);
  if (!technician) {
    return NextResponse.json(
      { error: "No technician roster entry is linked to this account" },
      { status: 404 }
    );
  }

  return NextResponse.json(await getMrfsForTechnician(technician.id));
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("mrf", "canCreate");
  if ("error" in auth) return auth.error;
  if (auth.role !== "TECHNICIAN") {
    return NextResponse.json({ error: "Only technicians file MRFs" }, { status: 403 });
  }

  const technician = await getTechnicianForUser(auth.session.user.id);
  if (!technician) {
    return NextResponse.json(
      { error: "No technician roster entry is linked to this account" },
      { status: 404 }
    );
  }

  const parsed = await parseBody(req, mrfCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { productId, qty: quantity, project: projectName } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const mrf = await prisma.$transaction(async (tx) => {
    const refNo = await nextRefNo(tx, "mrf", "MRF");
    const created = await tx.mrf.create({
      data: {
        refNo,
        technicianId: technician.id,
        project: projectName,
        items: {
          create: [{ productId, qtyRequested: quantity, qtyFulfilled: 0 }],
        },
      },
    });
    await tx.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: `Filed MRF for ${product.name} × ${quantity}`,
        refNo,
      },
    });
    return created;
  });

  revalidateAfterMutation(["mrf"], [`mrf-tech-${technician.id}`]);
  return NextResponse.json({ refNo: mrf.refNo }, { status: 201 });
}
