import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/effectivePermissions";
import { getMrfDetailForApi } from "@/lib/data/mrf";
import { getCompanySettings } from "@/lib/data/settings";
import { generateReportPdf } from "@/lib/pdfReport";
import { mrfStatusLabel } from "@/lib/mrfLifecycle";

/** Same access rule as GET /api/mrf/[id]: technicians only see their own request;
 * everyone else needs stock.canView or mrf.canView. */
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
  const mrf = await getMrfDetailForApi(id);

  if (!mrf) {
    return NextResponse.json({ error: "MRF not found" }, { status: 404 });
  }

  if (role === "TECHNICIAN" || !perms.stock?.canView) {
    const tech = await prisma.technician.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!tech || tech.id !== mrf.technician.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const company = await getCompanySettings();
  const statusLabel = mrfStatusLabel(mrf.status, mrf.totalFulfilled);

  const pdfBytes = await generateReportPdf({
    title: `Material Request ${mrf.refNo}`,
    summary: `${mrf.project} · ${mrf.technician.name} (${mrf.technician.empNo}) · ${statusLabel}${
      mrf.externalRefNo ? ` · Ext. ${mrf.externalRefNo}` : ""
    }`,
    generatedAt: new Date(),
    company,
    sections: [
      {
        title: "Line items",
        headers: ["Product", "Code", "Requested", "Fulfilled", "Remaining"],
        rows: mrf.items.map((item) => [
          item.productName,
          item.productCode,
          String(item.qtyRequested),
          String(item.qtyFulfilled),
          String(item.qtyRemaining),
        ]),
      },
      {
        title: "Fulfillment history",
        headers: ["Release slip", "Product", "Qty", "By", "Date"],
        rows: mrf.releases.map((r) => [
          r.refNo,
          r.productName,
          String(r.qty),
          r.byUser,
          r.createdAt.toLocaleDateString("en-PH"),
        ]),
      },
    ],
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${mrf.refNo}.pdf"`,
      "Content-Length": String(pdfBytes.length),
      // The PDF is a view over current DB state — never cache it.
      "Cache-Control": "no-store",
    },
  });
}
