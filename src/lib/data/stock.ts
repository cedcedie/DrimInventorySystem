import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 15;

async function fetchStockInData(page: number) {
  const [total, rows] = await Promise.all([
    prisma.stockIn.count(),
    prisma.stockIn.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: true, supplier: true },
    }),
  ]);

  return {
    rows: rows.map((si) => ({
      id: si.id,
      ref: si.refNo,
      date: si.createdAt.toISOString(),
      supplier: si.supplier.name,
      item: si.product.name,
      qty: si.qty,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

const getCachedFirstPageStockInData = unstable_cache(
  () => fetchStockInData(1),
  ["stock-in-page-1"],
  { revalidate: 15, tags: ["stock-in"] }
);

export async function getStockInData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return getCachedFirstPageStockInData();
  return fetchStockInData(page);
}

export type StockInData = Awaited<ReturnType<typeof getStockInData>>;

async function fetchStockOutData(page: number) {
  const [total, rows] = await Promise.all([
    prisma.stockOut.count(),
    prisma.stockOut.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: true, technician: true, mrf: true },
    }),
  ]);

  return {
    rows: rows.map((so) => ({
      id: so.id,
      ref: so.refNo,
      date: so.createdAt.toISOString(),
      tech: so.technician.name,
      item: so.product.name,
      qty: so.qty,
      mrf: so.mrf?.refNo ?? "—",
      project: so.mrf?.project ?? "—",
      empNo: so.technician.empNo,
      position: so.technician.position,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

const getCachedFirstPageStockOutData = unstable_cache(
  () => fetchStockOutData(1),
  ["stock-out-page-1"],
  { revalidate: 15, tags: ["stock-out"] }
);

export async function getStockOutData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return getCachedFirstPageStockOutData();
  return fetchStockOutData(page);
}

export type StockOutData = Awaited<ReturnType<typeof getStockOutData>>;

async function fetchStockFormOptions() {
  const [products, suppliers, technicians, pendingMrfs] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, stocks: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.technician.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, empNo: true } }),
    prisma.mrf.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { product: true, technician: true },
    }),
  ]);

  return {
    products,
    suppliers,
    technicians,
    pendingMrfs: pendingMrfs.map((m) => ({
      id: m.id,
      refNo: m.refNo,
      productId: m.productId,
      productName: m.product.name,
      qty: m.qty,
      project: m.project,
      technicianId: m.technicianId,
      technicianName: m.technician.name,
    })),
  };
}

export const getStockFormOptions = unstable_cache(fetchStockFormOptions, ["stock-form-options"], {
  revalidate: 15,
  tags: ["stock-in", "stock-out", "mrf", "technicians", "products"],
});

export type StockFormOptions = Awaited<ReturnType<typeof getStockFormOptions>>;
