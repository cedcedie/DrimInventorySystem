import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

async function fetchPurchaseRequests(page: number, q = "") {
  // Matches the PR #, supplier, who filed it, or a requested item — not just
  // the supplier.
  const where = q
    ? {
        OR: [
          { refNo: { contains: q, mode: "insensitive" as const } },
          { supplier: { name: { contains: q, mode: "insensitive" as const } } },
          { byUser: { name: { contains: q, mode: "insensitive" as const } } },
          {
            items: {
              some: {
                product: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" as const } },
                    { code: { contains: q, mode: "insensitive" as const } },
                  ],
                },
              },
            },
          },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.purchaseRequest.count({ where }),
    prisma.purchaseRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        supplier: { select: { name: true } },
        byUser: { select: { name: true } },
        decidedBy: { select: { name: true } },
        purchaseOrder: { select: { refNo: true } },
        items: { select: { qtyRequested: true } },
      },
    }),
  ]);

  return {
    rows: rows.map((pr) => ({
      id: pr.id,
      refNo: pr.refNo,
      supplier: pr.supplier?.name ?? null,
      status: pr.status,
      itemCount: pr.items.length,
      totalRequested: pr.items.reduce((s, i) => s + i.qtyRequested, 0),
      byUser: pr.byUser.name,
      decidedBy: pr.decidedBy?.name ?? null,
      decidedAt: pr.decidedAt?.toISOString() ?? null,
      purchaseOrderRefNo: pr.purchaseOrder?.refNo ?? null,
      createdAt: pr.createdAt.toISOString(),
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

async function loadFirstPagePurchaseRequests() {
  "use cache";
  tagAndLife("purchase-requests", CACHE_SECONDS.short);
  return fetchPurchaseRequests(1);
}

export async function getPurchaseRequestsData(params: { page?: number; q?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  if (page === 1 && !q) return loadFirstPagePurchaseRequests();
  return fetchPurchaseRequests(page, q);
}

export type PurchaseRequestsData = Awaited<ReturnType<typeof getPurchaseRequestsData>>;

export async function getPurchaseRequestDetail(id: string) {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, contact: true } },
      byUser: { select: { id: true, name: true } },
      decidedBy: { select: { name: true } },
      purchaseOrder: { select: { id: true, refNo: true } },
      items: {
        include: { product: { select: { id: true, name: true, code: true, unit: true } } },
      },
    },
  });

  if (!pr) return null;

  return {
    id: pr.id,
    refNo: pr.refNo,
    supplier: pr.supplier,
    status: pr.status,
    notes: pr.notes,
    byUser: pr.byUser,
    decidedBy: pr.decidedBy?.name ?? null,
    decidedAt: pr.decidedAt?.toISOString() ?? null,
    decisionNote: pr.decisionNote,
    purchaseOrder: pr.purchaseOrder,
    createdAt: pr.createdAt.toISOString(),
    items: pr.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productCode: item.product.code,
      unit: item.product.unit,
      qtyRequested: item.qtyRequested,
    })),
  };
}

export type PurchaseRequestDetail = NonNullable<Awaited<ReturnType<typeof getPurchaseRequestDetail>>>;

/** Pending PRs awaiting an Owner/Admin decision, for the Dashboard approval queue. */
export async function getPendingPurchaseRequestsCount() {
  return prisma.purchaseRequest.count({ where: { status: "PENDING" } });
}
