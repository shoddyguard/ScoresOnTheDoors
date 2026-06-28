import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

// Public paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/setup", "/api/auth", "/api/health", "/_next", "/favicon.ico"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  // In Auth.js v5 beta, the session is attached to req.auth
  const session = req.auth;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Redirect logged-in users away from login page
  if (pathname === "/login" && session?.user?.id) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Allow public paths without auth
  if (isPublic) return NextResponse.next();

  // Require authentication for everything else
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes require Admin role
  if (pathname.startsWith("/admin") && session.user.role !== "Admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
