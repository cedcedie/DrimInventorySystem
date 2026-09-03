import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Backed by Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set (see
// .env.example) — a shared store all Vercel instances/cold starts read the
// same buckets from, unlike a plain in-memory Map. Falls back to the
// in-memory limiter below when those env vars are absent (e.g. local dev
// without an Upstash account) or if Upstash itself is unreachable — a soft
// deterrent in that case, not a hard guarantee, but never a hard failure.
const upstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = upstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Upstash bakes the limit/window into the Ratelimit instance rather than
// taking it per call, so instances are cached per distinct (limit, window)
// pair. This app only ever uses a handful of those, so the cache stays tiny.
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  const cached = limiters.get(cacheKey);
  if (cached) return cached;

  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
  const rl = new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    // Skips Upstash's extra analytics-logging round trip — not needed here.
    analytics: false,
  });
  limiters.set(cacheKey, rl);
  return rl;
}

const buckets = new Map<string, number[]>();

function checkRateLimitInMemory(
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

export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  if (!redis) {
    return checkRateLimitInMemory(key, opts);
  }

  try {
    const { success, reset } = await getLimiter(opts.limit, opts.windowMs).limit(key);
    return { allowed: success, retryAfterMs: success ? 0 : Math.max(0, reset - Date.now()) };
  } catch (e) {
    // An Upstash outage shouldn't take real requests down with it — fail
    // open onto the in-memory limiter rather than block everyone.
    console.error("Upstash rate limit check failed, falling back to in-memory:", e);
    return checkRateLimitInMemory(key, opts);
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
