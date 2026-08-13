import { Prisma, type PrismaClient } from "@/generated/prisma";

type Tx = PrismaClient | Prisma.TransactionClient;

type RefModel = "stockInBatch" | "stockOut" | "mrf" | "stockAdjustment" | "purchaseOrder";

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

/** True for a Postgres Serializable-isolation write-conflict abort (Prisma P2034).
 * This is the failure mode that actually fires when two requests race inside
 * `nextRefNo`'s read-then-insert under Serializable isolation — the unique
 * constraint on `refNo` is a backstop that rarely trips because the DB aborts
 * the losing transaction first. Both need to be retried, or a race under real
 * concurrent load surfaces as a raw, unretried error to the second user. */
export function isSerializationConflictError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/** Retries a transaction when two requests race for the same ref number, or
 * more generally lose a Serializable-isolation write conflict. */
export async function withRefNoRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retryable = isUniqueRefNoError(error) || isSerializationConflictError(error);
      if (!retryable || attempt === maxAttempts - 1) throw error;
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
