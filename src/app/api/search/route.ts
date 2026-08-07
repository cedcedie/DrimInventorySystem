import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lightweight global search across products, MRFs, and stock slips. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const like = q.replace(/[%_]/g, "");

  const [products, mrfs, stockIns, stockOuts] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: like, mode: "insensitive" } },
          { code: { contains: like, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true },
      take: 5,
    }),
    prisma.mrf.findMany({
      where: {
        OR: [
          { refNo: { contains: like, mode: "insensitive" } },
          { externalRefNo: { contains: like, mode: "insensitive" } },
          { project: { contains: like, mode: "insensitive" } },
        ],
      },
      select: { id: true, refNo: true, project: true, status: true },
      take: 5,
    }),
    prisma.stockIn.findMany({
      where: { refNo: { contains: like, mode: "insensitive" } },
      select: { id: true, refNo: true },
      take: 3,
    }),
    prisma.stockOut.findMany({
      where: { refNo: { contains: like, mode: "insensitive" } },
      select: { id: true, refNo: true },
      take: 3,
    }),
  ]);

  const results = [
    ...products.map((p) => ({
      type: "product" as const,
      id: p.id,
      label: p.name,
      meta: p.code,
      href: "/products",
    })),
    ...mrfs.map((m) => ({
      type: "mrf" as const,
      id: m.id,
      label: m.refNo,
      meta: `${m.project} · ${m.status}`,
      href: "/stock",
    })),
    ...stockIns.map((s) => ({
      type: "slip" as const,
      id: s.id,
      label: s.refNo,
      meta: "Stock In",
      href: "/stock",
    })),
    ...stockOuts.map((s) => ({
      type: "slip" as const,
      id: s.id,
      label: s.refNo,
      meta: "Stock Out",
      href: "/stock",
    })),
  ];

  return NextResponse.json({ results });
}
