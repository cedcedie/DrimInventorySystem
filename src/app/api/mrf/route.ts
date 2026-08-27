import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getTechnicianForUser, getMrfsForTechnician } from "@/lib/data/mrf";
import { prisma } from "@/lib/prisma";
import { isProductRequestable } from "@/lib/mrfLifecycle";
import { notifyWarehouseMrfFiled } from "@/lib/notifications";
import { nextRefNo } from "@/lib/refNo";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { mrfCreateSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("mrf");
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

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "1");
  return NextResponse.json(await getMrfsForTechnician(technician.id, page));
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
  if (!product || !isProductRequestable(product.archivedAt)) {
    return NextResponse.json({ error: "Product not found or archived" }, { status: 404 });
  }

  try {
    // Ref number comes from the atomic RefCounter (outside this transaction —
    // it's a single row-locking increment, correct on its own without needing
    // Serializable isolation; wrapping it in one would make the counter abort
    // on conflict instead of just queuing behind the other request, which is
    // exactly the failure mode this route used to hit under real concurrent
    // filing). Nothing else in this transaction is contested the same way, so
    // it runs at the default isolation level.
    const refNo = await nextRefNo(prisma, "MRF");
    const mrf = await prisma.$transaction(async (tx) => {
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
    await notifyWarehouseMrfFiled({
      mrfRefNo: mrf.refNo,
      project: projectName,
      technicianName: technician.name,
      excludeUserId: auth.session.user.id,
    });
    return NextResponse.json({ refNo: mrf.refNo }, { status: 201 });
  } catch (e) {
    // Surface a clean JSON error instead of an unhandled 500 for anything
    // unexpected (the ref-number step itself can no longer collide).
    const message = e instanceof Error ? e.message : "Failed to file MRF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
