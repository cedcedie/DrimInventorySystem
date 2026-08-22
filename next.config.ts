import type { NextConfig } from "next";
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

export default nextConfig;
