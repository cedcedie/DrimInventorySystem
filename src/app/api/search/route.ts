import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mrfStatusLabel } from "@/lib/mrfLifecycle";
import { searchIncludesWarehouseSlips, searchOwnMrfsOnly } from "@/lib/stockTabs";

/** Lightweight global search across products, MRFs, and stock slips.
 * Technicians only see their own MRFs (+ catalog products for filing help). */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const like = q.replace(/[%_]/g, "");
  const isTech = role === "TECHNICIAN";
  const ownMrfsOnly = searchOwnMrfsOnly(isTech);
  const includeSlips = searchIncludesWarehouseSlips(isTech);

  let techId: string | undefined;
  if (ownMrfsOnly) {
    const tech = await prisma.technician.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    techId = tech?.id;
  }

  const [products, mrfs, stockIns, stockOuts] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: like, mode: "insensitive" } },
          { code: { contains: like, mode: "insensitive" } },
        ],
        archivedAt: null,
      },
      select: { id: true, name: true, code: true },
      take: 5,
    }),
    ownMrfsOnly && techId === undefined
      ? Promise.resolve([])
      : prisma.mrf.findMany({
          where: {
            ...(techId ? { technicianId: techId } : {}),
            OR: [
              { refNo: { contains: like, mode: "insensitive" } },
              { externalRefNo: { contains: like, mode: "insensitive" } },
              { project: { contains: like, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            refNo: true,
            project: true,
            status: true,
            items: { select: { qtyFulfilled: true } },
          },
          take: 5,
        }),
    includeSlips
      ? prisma.stockInBatch.findMany({
          where: { refNo: { contains: like, mode: "insensitive" } },
          select: { id: true, refNo: true },
          take: 3,
        })
      : Promise.resolve([]),
    includeSlips
      ? prisma.stockOut.findMany({
          where: { refNo: { contains: like, mode: "insensitive" } },
          select: { id: true, refNo: true },
          take: 3,
        })
      : Promise.resolve([]),
  ]);

  const results = [
    ...products.map((p) => ({
      type: "product" as const,
      id: p.id,
      label: p.name,
      meta: p.code,
      href: isTech ? "/stock" : "/products",
    })),
    ...mrfs.map((m) => {
      const fulfilled = m.items.reduce((s, i) => s + i.qtyFulfilled, 0);
      return {
        type: "mrf" as const,
        id: m.id,
        label: m.refNo,
        meta: `${m.project} · ${mrfStatusLabel(m.status, fulfilled)}`,
        href: isTech ? "/stock" : "/stock?tab=requests",
      };
    }),
    ...stockIns.map((s) => ({
      type: "slip" as const,
      id: s.id,
      label: s.refNo,
      meta: "Stock In (SI)",
      href: "/stock?tab=in",
    })),
    ...stockOuts.map((s) => ({
      type: "slip" as const,
      id: s.id,
      label: s.refNo,
      meta: "Stock Out (SO)",
      href: "/stock?tab=out",
    })),
  ];

  return NextResponse.json({ results });
}
