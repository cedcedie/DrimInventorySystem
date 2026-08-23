import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getTechniciansData } from "@/lib/data/technicians";
import { prisma } from "@/lib/prisma";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { parseBody } from "@/lib/validate";
import { technicianSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireModuleAccess("technicians");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "1");
  return NextResponse.json(await getTechniciansData({ page }));
}

export async function POST(req: Request) {
  const auth = await requireModuleAccess("technicians", "canCreate");
  if ("error" in auth) return auth.error;
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Only Owner can add technicians" }, { status: 403 });
  }

  const parsed = await parseBody(req, technicianSchema);
  if ("error" in parsed) return parsed.error;
  const { empNo, name, position } = parsed.data;

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
