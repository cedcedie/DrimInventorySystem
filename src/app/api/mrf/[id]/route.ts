import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/effectivePermissions";
import { getTechnicianForUser } from "@/lib/data/mrf";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const mrfPatchSchema = z.object({
  action: z.enum(["cancel"]),
  reason: z.string().trim().max(300).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const mrf = await prisma.mrf.findUnique({
    where: { id },
    include: {
      technician: { select: { id: true, name: true, empNo: true, position: true, userId: true } },
      items: {
        include: {
          product: {
            select: { id: true, name: true, code: true, unit: true, stocks: true },
          },
        },
      },
      stockOuts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          refNo: true,
          qty: true,
          createdAt: true,
          product: { select: { name: true, code: true } },
          byUser: { select: { name: true } },
        },
      },
    },
  });

  if (!mrf) {
    return NextResponse.json({ error: "MRF not found" }, { status: 404 });
  }

  if (auth.role === "TECHNICIAN") {
    const tech = await getTechnicianForUser(auth.session.user.id);
    if (!tech || tech.id !== mrf.technicianId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const totalRequested = mrf.items.reduce((s, i) => s + i.qtyRequested, 0);
  const totalFulfilled = mrf.items.reduce((s, i) => s + i.qtyFulfilled, 0);

  return NextResponse.json({
    id: mrf.id,
    refNo: mrf.refNo,
    externalRefNo: mrf.externalRefNo,
    project: mrf.project,
    description: mrf.description,
    status: mrf.status,
    createdAt: mrf.createdAt.toISOString(),
    technician: mrf.technician,
    totalRequested,
    totalFulfilled,
    items: mrf.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productCode: item.product.code,
      unit: item.product.unit,
      availableStock: item.product.stocks,
      qtyRequested: item.qtyRequested,
      qtyFulfilled: item.qtyFulfilled,
      qtyRemaining: item.qtyRequested - item.qtyFulfilled,
      notes: item.notes,
    })),
    releases: mrf.stockOuts.map((so) => ({
      id: so.id,
      refNo: so.refNo,
      qty: so.qty,
      productName: so.product.name,
      productCode: so.product.code,
      byUser: so.byUser.name,
      createdAt: so.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("stock");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = await parseBody(req, mrfPatchSchema);
  if ("error" in parsed) return parsed.error;

  const mrf = await prisma.mrf.findUnique({
    where: { id },
    include: { items: { select: { qtyFulfilled: true } } },
  });
  if (!mrf) {
    return NextResponse.json({ error: "MRF not found" }, { status: 404 });
  }
  if (mrf.status === "CANCELLED") {
    return NextResponse.json({ error: "This MRF is already cancelled" }, { status: 409 });
  }
  if (mrf.status === "FULFILLED") {
    return NextResponse.json({ error: "Fully fulfilled MRFs cannot be cancelled" }, { status: 409 });
  }

  const perms = await getEffectivePermissions(auth.session.user.id, auth.role as Role);
  const canWarehouseCancel = Boolean(perms.stock?.canEdit);
  const anyReleased = mrf.items.some((i) => i.qtyFulfilled > 0);

  if (!canWarehouseCancel) {
    if (auth.role !== "TECHNICIAN" || !perms.mrf?.canCreate) {
      return NextResponse.json(
        { error: "Your permissions don't allow cancelling MRFs" },
        { status: 403 }
      );
    }
    const tech = await getTechnicianForUser(auth.session.user.id);
    if (!tech || tech.id !== mrf.technicianId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (anyReleased || mrf.status === "PARTIAL") {
      return NextResponse.json(
        { error: "Partially fulfilled requests can only be cancelled by warehouse staff" },
        { status: 403 }
      );
    }
  }

  const reason = parsed.data.reason?.trim();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.mrf.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await tx.activityLog.create({
      data: {
        userId: auth.session.user.id,
        action: reason ? `Cancelled MRF ${mrf.refNo} — ${reason}` : `Cancelled MRF ${mrf.refNo}`,
        refNo: mrf.refNo,
      },
    });
    return row;
  });

  revalidateAfterMutation(["mrf"], [`mrf-tech-${mrf.technicianId}`]);
  return NextResponse.json({ id: updated.id, status: updated.status, refNo: updated.refNo });
}
