import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit, getClientIp } from "./rateLimit";

// Buckets live in a module-level Map that persists across tests, so every
// test uses its own key rather than trying to reset shared state.
let keySeq = 0;
const freshKey = () => `test-key-${keySeq++}`;

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit", () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { limit: 5, windowMs: 60_000 });
    }
    expect(checkRateLimit(key, { limit: 5, windowMs: 60_000 }).allowed).toBe(false);
  });

  it("reports how long to wait when blocked", () => {
    const key = freshKey();
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    }
    const blocked = checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("keeps separate budgets per key, so one IP can't throttle another", () => {
    const a = freshKey();
    const b = freshKey();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(a, { limit: 5, windowMs: 60_000 });
    }
    expect(checkRateLimit(a, { limit: 5, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit(b, { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("allows again once the window has passed", () => {
    vi.useFakeTimers();
    const key = freshKey();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    }
    expect(checkRateLimit(key, { limit: 3, windowMs: 60_000 }).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit(key, { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("still blocks partway through the window", () => {
    vi.useFakeTimers();
    const key = freshKey();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    }
    vi.advanceTimersByTime(30_000);
    expect(checkRateLimit(key, { limit: 3, windowMs: 60_000 }).allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  it("reads the first address from x-forwarded-for", () => {
    const req = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://example.test", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(getClientIp(req)).toBe("203.0.113.9");
  });

  it("returns 'unknown' when no forwarding header is present", () => {
    expect(getClientIp(new Request("https://example.test"))).toBe("unknown");
  });
});
