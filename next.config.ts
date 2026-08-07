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
};

export default nextConfig;
