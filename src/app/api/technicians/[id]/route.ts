import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { technicianSchema } from "@/lib/schemas";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("technicians");
  if ("error" in auth) return auth.error;
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Only Owner can edit technicians" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = await parseBody(req, technicianSchema);
  if ("error" in parsed) return parsed.error;
  const { empNo, name, position } = parsed.data;

  try {
    const technician = await prisma.$transaction(async (tx) => {
      const updated = await tx.technician.update({
        where: { id },
        data: { empNo, name, position },
      });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Edited technician ${updated.name}`,
          refNo: updated.empNo,
        },
      });
      return updated;
    });

    revalidateAfterMutation(["technicians"]);
    return NextResponse.json({ id: technician.id });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Employee number already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess("technicians");
  if ("error" in auth) return auth.error;
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Only Owner can delete technicians" }, { status: 403 });
  }

  const { id } = await params;
  const technician = await prisma.technician.findUnique({ where: { id } });
  if (!technician) {
    return NextResponse.json({ error: "Technician not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.technician.delete({ where: { id } });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Removed technician ${technician.name} from roster`,
          refNo: technician.empNo,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Foreign key constraint")) {
      return NextResponse.json(
        { error: "Cannot delete a technician with existing MRFs or stock-out history" },
        { status: 409 }
      );
    }
    throw e;
  }

  revalidateAfterMutation(["technicians"]);
  return NextResponse.json({ ok: true });
}
