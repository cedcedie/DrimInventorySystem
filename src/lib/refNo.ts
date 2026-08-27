import { Prisma, type PrismaClient } from "@/generated/prisma";

type Tx = PrismaClient | Prisma.TransactionClient;

/** Highest numeric suffix among refs like `PREFIX-0123`. Ignores malformed values.
 * Only used now by the one-time RefCounter seed script — real ref generation
 * goes through the atomic counter below. */
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

/** Duck-typed instead of `instanceof Prisma.PrismaClientKnownRequestError` —
 * verified live that `instanceof` silently returns false here even though
 * `error.constructor.name` is exactly "PrismaClientKnownRequestError": two
 * separate instances of the generated Prisma module end up loaded (one for
 * the client `src/lib/prisma.ts` actually throws from, one this file's own
 * import resolves to), so the class reference differs even though the error
 * is genuinely a Prisma error with a real `.code`. This is why the retry
 * silently never fired under real concurrent load — every conflict was
 * misclassified as non-retryable and thrown straight through. */
function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if (!("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function isUniqueRefNoError(error: unknown): boolean {
  if (prismaErrorCode(error) !== "P2002") return false;
  const meta = (error as { meta?: { target?: unknown } }).meta;
  return Array.isArray(meta?.target) && (meta.target as string[]).includes("refNo");
}

/** Postgres Serializable-isolation write-conflict abort (Prisma P2034) — the failure mode that
 * actually fires when two requests race inside `nextRefNo`; the unique constraint on `refNo`
 * is just a backstop. Both need to be retried. */
export function isSerializationConflictError(error: unknown): boolean {
  return prismaErrorCode(error) === "P2034";
}

/** Retries a Serializable transaction on write-conflict abort (Prisma P2034).
 * Ref-number generation no longer needs this — the atomic RefCounter can't
 * collide — but a transaction that legitimately needs Serializable for other
 * reasons (e.g. reading `product.stocks` before deciding how to change it)
 * still aborts under real concurrent contention, because Postgres's
 * Serializable isolation aborts a conflicting transaction rather than just
 * queuing it behind the other one the way a plain row lock would. That's
 * correct behavior, not a bug — the fix is to retry, same as any other
 * optimistic-concurrency conflict. Verified live: 5 simultaneous Stock In
 * requests against the same product needed this to all succeed instead of
 * 4/5 surfacing a raw write-conflict error. */
export async function withSerializableRetry<T>(fn: () => Promise<T>, maxAttempts = 6): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retryable = isUniqueRefNoError(error) || isSerializationConflictError(error);
      if (!retryable || attempt === maxAttempts - 1) throw error;
      lastError = error;
      const backoffMs = 20 * (attempt + 1) + Math.random() * 30;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

/** Atomically increments a per-prefix counter (`RefCounter`) and formats the
 * result — `INSERT ... ON CONFLICT DO UPDATE SET value = value + 1` under the
 * hood, a single row-locking statement that queues concurrent callers instead
 * of racing them. Replaces the old "scan every existing row, compute max,
 * insert max+1" approach, which needed Serializable isolation + heavy retries
 * and still failed most of the time under real concurrent filing (verified
 * live: 4/5 simultaneous requests failed even with 8 retries and backoff).
 * Must be called inside the same transaction that inserts the row using the
 * returned ref, same as before. */
async function nextCounterRefNo(tx: Tx, prefix: string, padLength: number): Promise<string> {
  const counter = await tx.refCounter.upsert({
    where: { prefix },
    create: { prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatRefNo(prefix, counter.value, padLength);
}

/** Next ref from ActivityLog rows (e.g. RPT-001). Must be called inside the same
 * $transaction that inserts the row using the returned ref. */
export async function nextActivityRefNo(tx: Tx, prefix: string, padLength = 3): Promise<string> {
  return nextCounterRefNo(tx, prefix, padLength);
}

export async function nextRefNo(tx: Tx, prefix: string, padLength = 4): Promise<string> {
  return nextCounterRefNo(tx, prefix, padLength);
}
