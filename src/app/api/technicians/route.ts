import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getTechniciansData } from "@/lib/data/technicians";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";

export async function GET() {
  const auth = await requireModuleAccess("technicians");
  if ("error" in auth) return auth.error;

  return NextResponse.json(await getTechniciansData());
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("technicians");
  if ("error" in auth) return auth.error;
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Only Owner can add technicians" }, { status: 403 });
  }

  const body = await req.json();
  const empNo = (body.empNo ?? "").trim();
  const name = (body.name ?? "").trim();
  const position = (body.position ?? "").trim();

  if (!empNo || !name || !position) {
    return NextResponse.json({ error: "Employee number, name, and position are required" }, { status: 400 });
  }

  try {
    const technician = await prisma.$transaction(async (tx) => {
      const created = await tx.technician.create({ data: { empNo, name, position } });
      await tx.activityLog.create({
        data: {
          userId: auth.session.user.id,
          action: `Added technician ${created.name} to roster`,
          refNo: created.empNo,
        },
      });
      return created;
    });

    revalidateAfterMutation(["technicians"]);
    return NextResponse.json({ id: technician.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Employee number already exists" }, { status: 409 });
    }
    throw e;
  }
}
