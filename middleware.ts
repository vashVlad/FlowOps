import { NextRequest, NextResponse } from "next/server";
import { type Role, ROLE_HOME, isAllowedRoute } from "@/lib/roles";

// Paths that are always public (no auth required)
const PUBLIC_PATHS = ["/login", "/_next", "/api", "/favicon", "/FlowOps-Logo"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // activeRole is persisted by Zustand into localStorage under the key
  // "flowops-auth". Middleware runs server-side so it can't access
  // localStorage — instead we read it from a cookie we set on role switch.
  // Fall back to null (will redirect to login or home appropriately).
  const activeRole = req.cookies.get("flowops-active-role")?.value as Role | undefined;

  // No role cookie → user hasn't logged in or hasn't picked a role yet.
  // Let the app handle auth (AuthGuard takes care of the login redirect).
  if (!activeRole) return NextResponse.next();

  // Admin has unrestricted access
  if (activeRole === "admin") return NextResponse.next();

  // Role home: redirect "/" to the role's actual home page
  const home = ROLE_HOME[activeRole];
  if (pathname === "/" && home !== "/") {
    return NextResponse.redirect(new URL(home, req.url));
  }

  // Block routes the role has no access to
  if (!isAllowedRoute(activeRole, pathname)) {
    return NextResponse.redirect(new URL(home !== "/" ? home : "/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
