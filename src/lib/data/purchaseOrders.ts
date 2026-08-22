import { prisma } from "@/lib/prisma";
import { CACHE_SECONDS, tagAndLife } from "@/lib/cache";

const PAGE_SIZE = 15;

function deriveStatus(
  dbStatus: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED",
  totalOrdered: number,
  totalReceived: number
): "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED" {
  if (dbStatus === "CANCELLED" || dbStatus === "DRAFT") return dbStatus;
  if (totalReceived >= totalOrdered && totalOrdered > 0) return "RECEIVED";
  if (totalReceived > 0) return "PARTIALLY_RECEIVED";
  return "SENT";
}

async function fetchPurchaseOrders(page: number) {
  const [total, rows] = await Promise.all([
    prisma.purchaseOrder.count(),
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        supplier: { select: { name: true } },
        byUser: { select: { name: true } },
        items: { select: { qtyOrdered: true, qtyReceived: true } },
      },
    }),
  ]);

  return {
    rows: rows.map((po) => {
      const totalOrdered = po.items.reduce((s, i) => s + i.qtyOrdered, 0);
      const totalReceived = po.items.reduce((s, i) => s + i.qtyReceived, 0);
      return {
        id: po.id,
        refNo: po.refNo,
        supplier: po.supplier.name,
        status: deriveStatus(po.status, totalOrdered, totalReceived),
        itemCount: po.items.length,
        totalOrdered,
        totalReceived,
        byUser: po.byUser.name,
        createdAt: po.createdAt.toISOString(),
      };
    }),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

async function loadFirstPagePurchaseOrders() {
  "use cache";
  tagAndLife("purchase-orders", CACHE_SECONDS.short);
  return fetchPurchaseOrders(1);
}

export async function getPurchaseOrdersData(params: { page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  if (page === 1) return loadFirstPagePurchaseOrders();
  return fetchPurchaseOrders(page);
}

export type PurchaseOrdersData = Awaited<ReturnType<typeof getPurchaseOrdersData>>;

export async function getPurchaseOrderDetail(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, contact: true } },
      byUser: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, name: true, code: true, unit: true } } },
      },
      stockInBatches: {
        orderBy: { createdAt: "desc" },
        select: { id: true, refNo: true, createdAt: true, items: { select: { qty: true, productId: true } } },
      },
    },
  });

  if (!po) return null;

  const totalOrdered = po.items.reduce((s, i) => s + i.qtyOrdered, 0);
  const totalReceived = po.items.reduce((s, i) => s + i.qtyReceived, 0);

  return {
    id: po.id,
    refNo: po.refNo,
    supplier: po.supplier,
    status: deriveStatus(po.status, totalOrdered, totalReceived),
    notes: po.notes,
    byUser: po.byUser.name,
    createdAt: po.createdAt.toISOString(),
    totalOrdered,
    totalReceived,
    items: po.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productCode: item.product.code,
      unit: item.product.unit,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      qtyRemaining: item.qtyOrdered - item.qtyReceived,
    })),
    deliveries: po.stockInBatches.map((b) => ({
      id: b.id,
      refNo: b.refNo,
      createdAt: b.createdAt.toISOString(),
      qty: b.items.reduce((s, i) => s + i.qty, 0),
    })),
  };
}

export type PurchaseOrderDetail = NonNullable<Awaited<ReturnType<typeof getPurchaseOrderDetail>>>;

/** Open POs for a supplier, for the "link this delivery to a PO" picker in Stock In. */
export async function getOpenPurchaseOrdersForSupplier(supplierId: string) {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      supplierId,
      status: { in: ["SENT", "PARTIALLY_RECEIVED"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, code: true, unit: true } } },
      },
    },
  });

  return pos
    .map((po) => {
      const openItems = po.items
        .filter((item) => item.qtyReceived < item.qtyOrdered)
        .map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          productCode: item.product.code,
          unit: item.product.unit,
          qtyOrdered: item.qtyOrdered,
          qtyReceived: item.qtyReceived,
          qtyRemaining: item.qtyOrdered - item.qtyReceived,
        }));
      if (openItems.length === 0) return null;
      return { id: po.id, refNo: po.refNo, items: openItems };
    })
    .filter((po): po is NonNullable<typeof po> => po !== null);
}
