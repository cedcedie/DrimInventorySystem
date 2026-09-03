import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { canAccess } from "@/lib/rbac";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { PERMISSION_MODULES } from "@/lib/permissionDefaults";
import type { Role } from "@/generated/prisma";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

// Segments any signed-in user may reach (own account / shared utilities). "notifications"
// belongs here, not the role-gated static map — it's self-service, scoped server-side to
// session.user.id in the route handler.
const SELF_SERVICE_SEGMENTS = new Set(["profile", "me", "search", "blobs", "notifications"]);

// Configurable modules are gated by the Owner-managed matrix (DB); edge middleware can't
// read that cheaply, so we only require a session and let layout + API enforce it.
const CONFIGURABLE = new Set<string>(PERMISSION_MODULES);

// API paths whose first segment doesn't match the owning nav module.
const API_SEGMENT_TO_MODULE: Record<string, string> = {
  "stock-in": "stock",
  "stock-out": "stock",
  mrf: "mrf",
  categories: "products",
  upload: "products",
  "stock-adjustments": "inventory",
  permissions: "users",
  "purchase-orders": "purchaseOrders",
  "purchase-requests": "purchaseRequests",
};

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/auth") ||
    // Unauthenticated by design — uptime monitors and Vercel's own health
    // checks have no session to send.
    pathname === "/api/health"
  ) {
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
    const rl = await checkRateLimit(`mutate:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
    }
  }

  if (SELF_SERVICE_SEGMENTS.has(moduleSegment)) {
    return passWithPath(req, pathname);
  }

  if (CONFIGURABLE.has(moduleSegment)) {
    return passWithPath(req, pathname);
  }

  if (moduleSegment && !canAccess(session.user.role as Role, moduleSegment)) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return passWithPath(req, pathname);
});

function passWithPath(req: { headers: Headers }, pathname: string) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
