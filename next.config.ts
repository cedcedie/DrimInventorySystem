import type { NextConfig } from "next";

// Derive the R2 public-URL hostname at build time so next/image's remotePatterns
// stays in sync with whatever R2_PUBLIC_URL is configured per environment.
// R2_PUBLIC_URL is unset in .env.example (no live bucket to read a real value from),
// so this falls back to the default Cloudflare R2 public-bucket domain shape
// (`pub-<hash>.r2.dev`) plus the account's default R2 endpoint pattern.
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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: r2Hostname() },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
};

export default nextConfig;
