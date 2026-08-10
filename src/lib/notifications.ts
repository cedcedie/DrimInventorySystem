import { prisma } from "@/lib/prisma";

type NotifyInput = {
  userId: string;
  type: "mrf_filed" | "mrf_fulfilled" | "mrf_closed";
  title: string;
  body: string;
  href: string;
  refNo?: string;
};

/** Fan-out helpers — durable in Neon so every Vercel instance / user sees the same inbox. */
export async function createNotifications(inputs: NotifyInput[]) {
  if (inputs.length === 0) return;
  await prisma.notification.createMany({
    data: inputs.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      refNo: n.refNo ?? null,
    })),
  });
}

/** Active warehouse-side accounts (not technicians). */
export async function warehouseRecipientIds(excludeUserId?: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "WAREHOUSE_STAFF"] },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function notifyWarehouseMrfFiled(opts: {
  mrfRefNo: string;
  project: string;
  technicianName: string;
  excludeUserId?: string;
}) {
  const ids = await warehouseRecipientIds(opts.excludeUserId);
  await createNotifications(
    ids.map((userId) => ({
      userId,
      type: "mrf_filed" as const,
      title: `New MRF ${opts.mrfRefNo}`,
      body: `${opts.technicianName} requested materials for ${opts.project}`,
      href: "/stock?tab=requests",
      refNo: opts.mrfRefNo,
    }))
  );
}

export async function notifyTechMrfUpdate(opts: {
  technicianUserId: string | null | undefined;
  type: "mrf_fulfilled" | "mrf_closed";
  mrfRefNo: string;
  body: string;
}) {
  if (!opts.technicianUserId) return;
  await createNotifications([
    {
      userId: opts.technicianUserId,
      type: opts.type,
      title:
        opts.type === "mrf_fulfilled"
          ? `MRF ${opts.mrfRefNo} updated`
          : `MRF ${opts.mrfRefNo} closed`,
      body: opts.body,
      href: "/stock",
      refNo: opts.mrfRefNo,
    },
  ]);
}
