import type { Prisma, PrismaClient } from "@/generated/prisma";

type Tx = PrismaClient | Prisma.TransactionClient;

/** Generates the next sequential ref number for a given prefix by reading the
 * highest existing ref of that prefix and incrementing. Must be called inside
 * the same $transaction that inserts the row using the returned ref, so the
 * read+insert is atomic under serializable isolation (prevents two concurrent
 * mutations from generating the same ref). */
export async function nextRefNo(
  tx: Tx,
  model: "stockIn" | "stockOut" | "mrf" | "stockAdjustment",
  prefix: string,
  padLength = 4
): Promise<string> {
  const latest = await (tx[model] as { findFirst: (args: unknown) => Promise<{ refNo: string } | null> }).findFirst({
    where: { refNo: { startsWith: `${prefix}-` } },
    orderBy: { refNo: "desc" },
  });

  const latestNum = latest ? parseInt(latest.refNo.split("-")[1] ?? "0", 10) : 0;
  const nextNum = (Number.isFinite(latestNum) ? latestNum : 0) + 1;
  return `${prefix}-${String(nextNum).padStart(padLength, "0")}`;
}
