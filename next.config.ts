import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
function r2Hostname(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // fall through to default below if R2_PUBLIC_URL isn't a valid absolute URL
    }
  }
  return "*.r2.dev";
}

const nextConfig: NextConfig = {
  // Drops the "X-Powered-By: Next.js" response header (fingerprinting).
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: r2Hostname() },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
  experimental: {
    // Enables the `"use cache"` directive without flipping the whole app to
    // Cache Components (which would force every layout/auth path dynamic).
    useCache: true,
  },
  async headers() {
    return [
      {
        // Applies to every route — pages and API alike.
        source: "/:path*",
        headers: [
          // Force HTTPS on repeat visits. Cloudflare terminates TLS at the
          // edge already, but this stops any downgrade to plain HTTP on the
          // client side too. No preload — that's a one-way door best left to
          // a deliberate opt-in once the domain is stable.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Stops browsers from MIME-sniffing a response into something more
          // dangerous than its declared Content-Type (e.g. treating an
          // uploaded image as HTML/JS).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nothing in this app is meant to be framed by another origin —
          // blocks clickjacking-style embeds.
          { key: "X-Frame-Options", value: "DENY" },
          // Belt-and-suspenders alongside X-Frame-Options for browsers that
          // honor CSP's frame-ancestors instead. object-src none closes off
          // legacy Flash/plugin embedding; base-uri 'self' stops injected
          // <base> tags from redirecting relative asset/script URLs off-site.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
          // Don't leak the full referring URL (which can contain IDs/paths)
          // to third-party resources.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

// No DSN set (see .env.example) is a safe no-op — this wrapper only starts
// uploading source maps / injecting instrumentation once SENTRY_ORG and
// SENTRY_PROJECT are actually configured, and even then only real errors
// (there's a live NEXT_PUBLIC_SENTRY_DSN check in the client/server/edge
// config files below) get sent anywhere.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only Sentry's own build output should be noisy; keep everything else as-is.
  silent: !process.env.CI,
  // Attributes stack frames from third-party/framework code too, not just
  // this app's own files — worth the slightly larger source map upload for
  // how much easier it makes reading a real production stack trace.
  widenClientFileUpload: true,
  webpack: {
    // Sentry's own runtime debug logging, not this app's — pure build noise.
    treeshake: { removeDebugLogging: true },
    // No-op unless this is actually deployed on Vercel; harmless elsewhere.
    automaticVercelMonitors: true,
  },
});
