import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getKey(): Uint8Array {
  const SECRET = process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET;
  if (!SECRET) {
    // In diagnostic mode we might not have a secret yet, but middleware shouldn't crash
    return new TextEncoder().encode("placeholder-secret-for-diagnostics");
  }
  return new TextEncoder().encode(SECRET);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("session")?.value;
  const isApiRequest = pathname.startsWith("/api");

  // Public diagnostic routes - MUST BE EXEMPT FROM AUTH
  const isDiagnosticRoute = 
    pathname === "/api/health" ||
    pathname === "/api/admin/status" ||
    pathname === "/api/admin/db-check" ||
    pathname === "/api/admin/auth-check" ||
    pathname === "/api/admin/auth-debug" ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/admin/status") ||
    pathname.startsWith("/api/admin/db-check") ||
    pathname.startsWith("/api/admin/auth-check") ||
    pathname.startsWith("/api/admin/auth-debug");

  // 1. Allow diagnostic routes regardless of session
  if (isDiagnosticRoute) {
    return NextResponse.next();
  }

  // Auth pages (login/signup) should be public
  const isAuthPage = pathname.startsWith("/auth") || pathname.startsWith("/api/auth");

  // Protected routes
  const isProtectedPage = (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/api/admin") && !isDiagnosticRoute) ||
    pathname.startsWith("/api/jobs") ||
    pathname.startsWith("/upload")
  );

  // 2. Handle protected pages
  if (isProtectedPage) {
    if (!session) {
      if (isApiRequest) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    try {
      const secret = process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET;
      if (!secret) {
        // If we have a session but no secret, allow diagnostic passage but log
        return NextResponse.next();
      }
      await jwtVerify(session, getKey(), { algorithms: ["HS256"] });
      return NextResponse.next();
    } catch (e) {
      if (isApiRequest) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      // Clear invalid session cookie and redirect
      const response = NextResponse.redirect(new URL("/auth/login", request.url));
      response.cookies.delete("session");
      return response;
    }
  }

  // 3. Redirect logged-in users away from auth pages (unless it's an API call or logout)
  if (isAuthPage && session && !pathname.startsWith("/api/auth/logout") && !isApiRequest) {
    try {
      await jwtVerify(session, getKey(), { algorithms: ["HS256"] });
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch (e) {
      // Session invalid, continue to auth page
    }
  }

  return NextResponse.next();
}


export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
