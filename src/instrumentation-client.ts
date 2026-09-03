import * as Sentry from "@sentry/nextjs";

// Auto-loaded by Next.js for client-side instrumentation (no import needed
// anywhere else). Same no-op-without-a-DSN behavior as src/instrumentation.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1,
  // Session Replay is a paid, heavier feature this app's scale doesn't need —
  // leave both sampling rates at 0 rather than pull in the recording code.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
