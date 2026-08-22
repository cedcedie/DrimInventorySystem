import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

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

async function loadMrfsForTechnician(technicianId: string) {
  "use cache";
  tagAndLife(["mrf", `mrf-tech-${technicianId}`], CACHE_SECONDS.short);

  const mrfs = await prisma.mrf.findMany({
    where: { technicianId },
    orderBy: { createdAt: "desc" },
    take: 100,
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
  });

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
  };
}

/** Pending/partial MRFs with remaining line items, for the warehouse queue. */
async function loadOpenMrfsQueue() {
  "use cache";
  tagAndLife("mrf", CACHE_SECONDS.short);

  const mrfs = await prisma.mrf.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
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
  });

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
  };
}

export async function getMrfsForTechnician(technicianId: string) {
  return loadMrfsForTechnician(technicianId);
}

export async function getOpenMrfsQueue() {
  return loadOpenMrfsQueue();
}

export type MrfListData = Awaited<ReturnType<typeof getMrfsForTechnician>>;
export type OpenMrfsQueueData = Awaited<ReturnType<typeof getOpenMrfsQueue>>;
