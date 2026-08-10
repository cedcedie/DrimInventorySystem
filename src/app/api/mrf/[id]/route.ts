import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/effectivePermissions";
import {
  mrfCancelActivityAction,
  techMayCancelMrf,
  warehouseMayCancelMrf,
} from "@/lib/mrfLifecycle";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const mrfPatchSchema = z.object({
  action: z.enum(["cancel"]),
  reason: z.string().trim().max(300).optional(),
});

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** Warehouse (stock.canView) or technician (mrf.canView, own rows only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  const perms = await getEffectivePermissions(session.user.id, role);
  if (!perms.stock?.canView && !perms.mrf?.canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (role === "TECHNICIAN" || !perms.stock?.canView) {
    const tech = await prisma.technician.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  const perms = await getEffectivePermissions(session.user.id, role);
  const canWarehouseCancel = Boolean(perms.stock?.canEdit);
  const canTechCancel = role === "TECHNICIAN" && Boolean(perms.mrf?.canCreate);

  if (!canWarehouseCancel && !canTechCancel) {
    return NextResponse.json(
      { error: "Your permissions don't allow cancelling MRFs" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const parsed = await parseBody(req, mrfPatchSchema);
  if ("error" in parsed) return parsed.error;

  const reason = parsed.data.reason?.trim();

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const mrf = await tx.mrf.findUnique({
          where: { id },
          include: { items: { select: { qtyFulfilled: true } } },
        });
        if (!mrf) throw new HttpError("MRF not found", 404);
        if (mrf.status === "CANCELLED") {
          throw new HttpError("This MRF is already cancelled", 409);
        }
        if (mrf.status === "FULFILLED") {
          throw new HttpError("Fully fulfilled MRFs cannot be cancelled", 409);
        }

        const anyReleased = mrf.items.some((i) => i.qtyFulfilled > 0);

        if (!canWarehouseCancel) {
          const tech = await tx.technician.findFirst({
            where: { userId: session.user.id },
            select: { id: true },
          });
          if (!tech || tech.id !== mrf.technicianId) {
            throw new HttpError("Forbidden", 403);
          }
          if (!techMayCancelMrf(mrf.status, anyReleased)) {
            throw new HttpError(
              "Partially fulfilled requests can only be closed by warehouse staff",
              403
            );
          }
        } else if (!warehouseMayCancelMrf(mrf.status)) {
          throw new HttpError("This MRF cannot be cancelled in its current status", 409);
        }

        const result = await tx.mrf.updateMany({
          where: canWarehouseCancel
            ? { id, status: { in: ["PENDING", "PARTIAL"] } }
            : { id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });

        if (result.count === 0) {
          throw new HttpError("MRF could not be cancelled — status changed concurrently", 409);
        }

        await tx.activityLog.create({
          data: {
            userId: session.user.id,
            action: mrfCancelActivityAction(mrf.refNo, anyReleased, reason),
            refNo: mrf.refNo,
          },
        });

        return {
          id: mrf.id,
          status: "CANCELLED" as const,
          refNo: mrf.refNo,
          technicianId: mrf.technicianId,
          anyReleased,
        };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
    );

    revalidateAfterMutation(["mrf"], [`mrf-tech-${updated.technicianId}`]);
    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      refNo: updated.refNo,
      anyReleased: updated.anyReleased,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Cancel failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
