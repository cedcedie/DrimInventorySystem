import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { canAccess } from "@/lib/rbac";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import type { Role } from "@prisma/client";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

// Some API routes don't share a literal path segment with their owning nav
// module (e.g. /api/stock-in belongs to the "stock" module, /api/categories
// and /api/upload belong to "products"). Map those explicitly; anything not
// listed here falls back to using its own first path segment as the module.
const API_SEGMENT_TO_MODULE: Record<string, string> = {
  "stock-in": "stock",
  "stock-out": "stock",
  mrf: "stock",
  categories: "products",
  upload: "products",
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const session = req.auth;
  const segments = pathname.split("/").filter(Boolean);
  const isApiRoute = segments[0] === "api";
  const rawSegment = isApiRoute ? segments[1] : segments[0];
  const moduleSegment = isApiRoute ? (API_SEGMENT_TO_MODULE[rawSegment] ?? rawSegment) : rawSegment;

  if (!session?.user) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isApiRoute && ["POST", "PATCH", "DELETE"].includes(req.method)) {
    const rl = checkRateLimit(`mutate:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
    }
  }

  if (moduleSegment && !canAccess(session.user.role as Role, moduleSegment)) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
