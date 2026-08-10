import { Prisma, type PrismaClient } from "@/generated/prisma";

type Tx = PrismaClient | Prisma.TransactionClient;

type RefModel = "stockIn" | "stockOut" | "mrf" | "stockAdjustment";

/** Highest numeric suffix among refs like `PREFIX-0123`. Ignores malformed values. */
export function maxRefSuffix(refs: string[], prefix: string): number {
  const head = `${prefix}-`;
  let max = 0;

  for (const ref of refs) {
    if (!ref.startsWith(head)) continue;
    const num = parseInt(ref.slice(head.length), 10);
    if (Number.isFinite(num) && num > max) max = num;
  }

  return max;
}

export function formatRefNo(prefix: string, num: number, padLength = 4): string {
  return `${prefix}-${String(num).padStart(padLength, "0")}`;
}

export function isUniqueRefNoError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes("refNo")
  );
}

/** Retries a transaction when two requests race for the same ref number. */
export async function withRefNoRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isUniqueRefNoError(error) || attempt === maxAttempts - 1) throw error;
      lastError = error;
    }
  }

  throw lastError;
}

/** Generates the next sequential ref number for a given prefix by reading the
 * highest existing numeric suffix and incrementing. Must be called inside the
 * same $transaction that inserts the row using the returned ref. */
/** Next ref from ActivityLog rows (e.g. RPT-001). */
export async function nextActivityRefNo(
  tx: Tx,
  prefix: string,
  padLength = 3
): Promise<string> {
  const rows = await tx.activityLog.findMany({
    where: { refNo: { startsWith: `${prefix}-` } },
    select: { refNo: true },
  });

  const nextNum =
    maxRefSuffix(
      rows.map((row) => row.refNo),
      prefix
    ) + 1;

  return formatRefNo(prefix, nextNum, padLength);
}

export async function nextRefNo(
  tx: Tx,
  model: RefModel,
  prefix: string,
  padLength = 4
): Promise<string> {
  const rows = await (tx[model] as { findMany: (args: unknown) => Promise<Array<{ refNo: string }>> }).findMany({
    where: { refNo: { startsWith: `${prefix}-` } },
    select: { refNo: true },
  });

  const nextNum = maxRefSuffix(
    rows.map((row) => row.refNo),
    prefix
  ) + 1;

  return formatRefNo(prefix, nextNum, padLength);
}
