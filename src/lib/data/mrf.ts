import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";
import { formatDateForExport } from "@/lib/quickExport";
import type { Prisma } from "@/generated/prisma";

/** Resolves the Technician roster row linked to a logged-in TECHNICIAN user. */
export async function getTechnicianForUser(userId: string) {
  return prisma.technician.findUnique({ where: { userId } });
}

/** Shared by the detail API route and the PDF export route so both render from the same query. */
export async function getMrfDetailForApi(id: string) {
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

  if (!mrf) return null;

  const totalRequested = mrf.items.reduce((s, i) => s + i.qtyRequested, 0);
  const totalFulfilled = mrf.items.reduce((s, i) => s + i.qtyFulfilled, 0);

  return {
    id: mrf.id,
    refNo: mrf.refNo,
    externalRefNo: mrf.externalRefNo,
    project: mrf.project,
    description: mrf.description,
    status: mrf.status,
    createdAt: mrf.createdAt,
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
      createdAt: so.createdAt,
    })),
  };
}

export type MrfDetailForApi = NonNullable<Awaited<ReturnType<typeof getMrfDetailForApi>>>;

function deriveMrfStatus(
  dbStatus: "PENDING" | "PARTIAL" | "FULFILLED" | "CANCELLED",
  totalRequested: number,
  totalFulfilled: number
): "PENDING" | "PARTIAL" | "FULFILLED" | "CANCELLED" {
  if (dbStatus === "CANCELLED") return "CANCELLED";
  if (totalFulfilled === 0) return "PENDING";
  if (totalFulfilled >= totalRequested) return "FULFILLED";
  return "PARTIAL";
}

const MRF_PAGE_SIZE = 15;

async function loadMrfsForTechnician(technicianId: string, page: number) {
  "use cache";
  tagAndLife(["mrf", `mrf-tech-${technicianId}`], CACHE_SECONDS.short);

  const [total, mrfs] = await Promise.all([
    prisma.mrf.count({ where: { technicianId } }),
    prisma.mrf.findMany({
      where: { technicianId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * MRF_PAGE_SIZE,
      take: MRF_PAGE_SIZE,
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    rows: mrfs.map((m) => {
      const totalRequested = m.items.reduce((sum, item) => sum + item.qtyRequested, 0);
      const totalFulfilled = m.items.reduce((sum, item) => sum + item.qtyFulfilled, 0);
      const itemCount = m.items.length;

      return {
        id: m.id,
        mrf: m.refNo,
        date: m.createdAt.toISOString(),
        item: itemCount === 1 ? m.items[0].product.name : `${itemCount} items`,
        qty: totalRequested,
        qtyFulfilled: totalFulfilled,
        project: m.project,
        externalRefNo: m.externalRefNo,
        status: deriveMrfStatus(m.status, totalRequested, totalFulfilled),
        itemCount,
      };
    }),
    page,
    totalPages: Math.max(1, Math.ceil(total / MRF_PAGE_SIZE)),
    total,
  };
}

const OPEN_MRF_PAGE_SIZE = 15;

export type OpenMrfsFilters = { mrfNumber?: string; project?: string; item?: string; technician?: string };

/** Pending/partial MRFs with remaining line items, for the warehouse queue.
 * Not cached: paginated and polled by liveHot, so a stale "use cache" entry
 * would fight the client's own 10s refetch. */
// Status PENDING/PARTIAL should always imply at least one item still open —
// fulfillMrfItemInTx keeps the two in sync on every write. But the count
// must match this exactly, or pagination goes stale the moment that
// invariant ever slips (a page rendering fewer rows than the count implies,
// or a trailing page going unreachable). Filtering at the DB level via a
// field-to-field comparison (same pattern as stock.ts's pending-MRF query)
// keeps `total`/`totalPages` truthful no matter what. Shared by the paginated
// list and the export route, so both apply exactly the same rows.
function buildOpenMrfsWhere(filters: OpenMrfsFilters = {}): Prisma.MrfWhereInput {
  const { mrfNumber, project, item, technician } = filters;

  const and: Prisma.MrfWhereInput[] = [];
  if (mrfNumber) and.push({ refNo: { contains: mrfNumber, mode: "insensitive" } });
  if (project) and.push({ project: { contains: project, mode: "insensitive" } });
  if (technician) and.push({ technician: { name: { contains: technician, mode: "insensitive" } } });
  if (item) {
    and.push({
      items: {
        some: {
          product: {
            OR: [
              { name: { contains: item, mode: "insensitive" } },
              { code: { contains: item, mode: "insensitive" } },
            ],
          },
        },
      },
    });
  }

  return {
    status: { in: ["PENDING", "PARTIAL"] },
    items: { some: { qtyFulfilled: { lt: prisma.mrfItem.fields.qtyRequested } } },
    ...(and.length ? { AND: and } : {}),
  };
}

async function loadOpenMrfsQueue(page: number, filters: OpenMrfsFilters = {}) {
  const where = buildOpenMrfsWhere(filters);

  const [total, mrfs] = await Promise.all([
    prisma.mrf.count({ where }),
    prisma.mrf.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * OPEN_MRF_PAGE_SIZE,
      take: OPEN_MRF_PAGE_SIZE,
      include: {
        technician: { select: { name: true, empNo: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                stocks: true,
                unit: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const openMrfs = mrfs
    .map((m) => {
      const openItems = m.items
        .filter((item) => item.qtyFulfilled < item.qtyRequested)
        .map((item) => ({
          id: item.id,
          productName: item.product.name,
          productCode: item.product.code,
          unit: item.product.unit,
          qtyRequested: item.qtyRequested,
          qtyFulfilled: item.qtyFulfilled,
          qtyRemaining: item.qtyRequested - item.qtyFulfilled,
          availableStock: item.product.stocks,
        }));

      if (openItems.length === 0) return null;

      const totalRequested = m.items.reduce((sum, item) => sum + item.qtyRequested, 0);
      const totalFulfilled = m.items.reduce((sum, item) => sum + item.qtyFulfilled, 0);

      return {
        id: m.id,
        refNo: m.refNo,
        project: m.project,
        externalRefNo: m.externalRefNo,
        description: m.description,
        status: deriveMrfStatus(m.status, totalRequested, totalFulfilled),
        technicianName: m.technician.name,
        empNo: m.technician.empNo,
        createdAt: m.createdAt.toISOString(),
        items: openItems,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return {
    mrfs: openMrfs,
    openItemCount: openMrfs.reduce((sum, m) => sum + m.items.length, 0),
    page,
    totalPages: Math.max(1, Math.ceil(total / OPEN_MRF_PAGE_SIZE)),
    total,
  };
}

export async function getMrfsForTechnician(technicianId: string, page = 1) {
  return loadMrfsForTechnician(technicianId, page);
}

export async function getOpenMrfsQueue(page = 1, filters: OpenMrfsFilters = {}) {
  const trimmed: OpenMrfsFilters = {
    mrfNumber: filters.mrfNumber?.trim() || undefined,
    project: filters.project?.trim() || undefined,
    item: filters.item?.trim() || undefined,
    technician: filters.technician?.trim() || undefined,
  };
  return loadOpenMrfsQueue(page, trimmed);
}

export type MrfListData = Awaited<ReturnType<typeof getMrfsForTechnician>>;

const OPEN_MRF_EXPORT_CAP = 2000;

/** Same filters as the paginated queue, but every matching MRF's open lines
 * (capped) — feeds the screen's "download what I'm looking at" export button.
 * One row per line item, same as the Stock In/Out exports. */
export async function getOpenMrfsExportRows(filters: OpenMrfsFilters) {
  const trimmed: OpenMrfsFilters = {
    mrfNumber: filters.mrfNumber?.trim() || undefined,
    project: filters.project?.trim() || undefined,
    item: filters.item?.trim() || undefined,
    technician: filters.technician?.trim() || undefined,
  };
  const where = buildOpenMrfsWhere(trimmed);
  const [total, mrfs] = await Promise.all([
    prisma.mrf.count({ where }),
    prisma.mrf.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: OPEN_MRF_EXPORT_CAP,
      include: {
        technician: { select: { name: true } },
        items: { include: { product: { select: { name: true, code: true, stocks: true, unit: true } } } },
      },
    }),
  ]);
  // The cap applies at the MRF level, not the flattened line-item level.
  const truncated = mrfs.length < total;

  const headers = ["Request # (MRF)", "Filed", "Technician", "Project", "Item", "Code", "Need", "In Stock"];
  const rows = mrfs.flatMap((mrf) =>
    mrf.items
      .filter((item) => item.qtyFulfilled < item.qtyRequested)
      .map((item) => [
        mrf.refNo,
        formatDateForExport(mrf.createdAt),
        mrf.technician.name,
        mrf.project,
        item.product.name,
        item.product.code,
        `${item.qtyRequested - item.qtyFulfilled} ${item.product.unit}`,
        `${item.product.stocks} ${item.product.unit}`,
      ])
  );
  return { headers, rows, truncated };
}
export type OpenMrfsQueueData = Awaited<ReturnType<typeof getOpenMrfsQueue>>;
