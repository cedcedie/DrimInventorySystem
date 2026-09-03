import * as Sentry from "@sentry/nextjs";

// Runs once per server/edge runtime on boot. No-op unless NEXT_PUBLIC_SENTRY_DSN
// is actually set (see .env.example) — safe to leave wired up in every env.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      // Small app, low traffic — capture every transaction rather than
      // sampling, so a real incident isn't missing the trace that explains it.
      tracesSampleRate: 1,
      debug: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1,
      debug: false,
    });
  }
}

// Lets Sentry capture errors thrown from nested React Server Components that
// Next.js would otherwise only surface via the (already-caught) error boundaries.
export const onRequestError = Sentry.captureRequestError;
