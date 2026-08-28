import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";
import { formatDateForExport } from "@/lib/quickExport";

const PAGE_SIZE = 15;

export type PurchaseRequestsFilters = { refNo?: string; supplier?: string; item?: string; filedBy?: string };

/** Each filled-in field is its own AND'd condition — not one free-text box
 * OR-ing across everything. Shared by the paginated list and the export
 * route, so both apply exactly the same rows. */
function buildPurchaseRequestsWhere(filters: PurchaseRequestsFilters = {}) {
  const { refNo, supplier, item, filedBy } = filters;
  const and: object[] = [];
  if (refNo) and.push({ refNo: { contains: refNo, mode: "insensitive" as const } });
  if (supplier) and.push({ supplier: { name: { contains: supplier, mode: "insensitive" as const } } });
  if (filedBy) and.push({ byUser: { name: { contains: filedBy, mode: "insensitive" as const } } });
  if (item) {
    and.push({
      items: {
        some: {
          product: {
            OR: [
              { name: { contains: item, mode: "insensitive" as const } },
              { code: { contains: item, mode: "insensitive" as const } },
            ],
          },
        },
      },
    });
  }
  return and.length ? { AND: and } : {};
}

async function fetchPurchaseRequests(page: number, filters: PurchaseRequestsFilters = {}) {
  const where = buildPurchaseRequestsWhere(filters);

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

export async function getPurchaseRequestsData(params: { page?: number } & PurchaseRequestsFilters) {
  const page = Math.max(1, params.page ?? 1);
  const filters: PurchaseRequestsFilters = {
    refNo: params.refNo?.trim() || undefined,
    supplier: params.supplier?.trim() || undefined,
    item: params.item?.trim() || undefined,
    filedBy: params.filedBy?.trim() || undefined,
  };
  const hasFilter = Object.values(filters).some(Boolean);
  if (page === 1 && !hasFilter) return loadFirstPagePurchaseRequests();
  return fetchPurchaseRequests(page, filters);
}

export type PurchaseRequestsData = Awaited<ReturnType<typeof getPurchaseRequestsData>>;

const EXPORT_CAP = 2000;

/** Same filters as the paginated list, but every matching request's lines
 * (capped) — feeds the screen's "download what I'm looking at" export button.
 * One row per requested item, so quantities stay traceable per product. */
export async function getPurchaseRequestsExportRows(filters: PurchaseRequestsFilters) {
  const trimmed: PurchaseRequestsFilters = {
    refNo: filters.refNo?.trim() || undefined,
    supplier: filters.supplier?.trim() || undefined,
    item: filters.item?.trim() || undefined,
    filedBy: filters.filedBy?.trim() || undefined,
  };
  const where = buildPurchaseRequestsWhere(trimmed);
  const requests = await prisma.purchaseRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_CAP,
    include: {
      supplier: { select: { name: true } },
      byUser: { select: { name: true } },
      items: { include: { product: { select: { name: true, code: true } } } },
    },
  });

  const headers = ["Request #", "Filed", "Supplier", "Item", "Code", "Qty", "Status", "Filed By"];
  const rows = requests.flatMap((pr) =>
    pr.items.map((item) => [
      pr.refNo,
      formatDateForExport(pr.createdAt),
      pr.supplier?.name ?? "Not specified",
      item.product.name,
      item.product.code,
      String(item.qtyRequested),
      pr.status,
      pr.byUser.name,
    ])
  );
  return { headers, rows };
}

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
