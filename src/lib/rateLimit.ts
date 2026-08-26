// KNOWN LIMITATION: in-memory only. On Vercel this resets on every cold
// start/redeploy and doesn't coordinate across concurrent serverless
// instances — it's a soft deterrent against casual brute-forcing, not a
// hard guarantee under sustained/distributed attack. A real fix needs a
// shared store (e.g. Upstash Redis, which has a first-class Vercel
// integration) — deliberately not done yet; flagged for whoever picks this
// up next rather than adding new infra right before handover.
const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= opts.limit) {
    const retryAfterMs = timestamps[0] + opts.windowMs - now;
    buckets.set(key, timestamps);
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true, retryAfterMs: 0 };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
