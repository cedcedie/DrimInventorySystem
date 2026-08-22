import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { canAccess } from "@/lib/rbac";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { PERMISSION_MODULES } from "@/lib/permissionDefaults";
import type { Role } from "@/generated/prisma";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

// Segments any signed-in user may reach (own account / shared utilities).
// "notifications" belongs here, not in the role-gated static map below — a
// user's own notification inbox (GET/PATCH /api/notifications) is inherently
// self-service like /me and /profile, scoped server-side to session.user.id
// in the route handler itself. It was never added to rbac.ts's MODULE_ACCESS
// either, so with no entry in EITHER list it fell through to the "static
// module, check the role map" branch and got a blanket 403 for every role,
// including Owner — the notification bell was fetching nothing for anyone.
const SELF_SERVICE_SEGMENTS = new Set(["profile", "me", "search", "blobs", "notifications"]);

// Configurable modules are gated by the Owner-managed matrix (DB). Edge
// middleware can't read that cheaply, so for those we only require a session
// and let layout + API enforce view/create/edit/delete/export.
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

  if (SELF_SERVICE_SEGMENTS.has(moduleSegment)) {
    return passWithPath(req, pathname);
  }

  // Configurable modules: session is enough here; layout/API enforce the matrix.
  if (CONFIGURABLE.has(moduleSegment)) {
    return passWithPath(req, pathname);
  }

  // Static modules (settings, activity, permissions, …): role map still applies.
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
