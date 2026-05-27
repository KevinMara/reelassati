import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getKey(): Uint8Array {
  const SECRET = process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET;
  if (!SECRET) {
    throw new Error("AUTH_SECRET (or INTERNAL_AGENT_SECRET) env var is required");
  }
  return new TextEncoder().encode(SECRET);
}


export async function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const isApiRequest = request.nextUrl.pathname.startsWith("/api");


  const isAuthPage = request.nextUrl.pathname.startsWith("/auth") || request.nextUrl.pathname.startsWith("/api/auth");
  const isDiagnosticRoute = 
    request.nextUrl.pathname === "/api/health" ||
    request.nextUrl.pathname.startsWith("/api/admin/status") ||
    request.nextUrl.pathname.startsWith("/api/admin/db-check") ||
    request.nextUrl.pathname.startsWith("/api/admin/auth-check") ||
    request.nextUrl.pathname.startsWith("/api/admin/auth-debug");

  const isProtectedPage =
    (request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/app") ||
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/api/admin") ||
    request.nextUrl.pathname.startsWith("/api/jobs")) && !isDiagnosticRoute;

  if (isProtectedPage) {
    if (!session) {
      if (isApiRequest) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    try {
      await jwtVerify(session, getKey(), { algorithms: ["HS256"] });
      return NextResponse.next();
    } catch (e) {
      if (isApiRequest) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  if (isAuthPage && session) {
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
  matcher: ["/dashboard/:path*", "/app/:path*", "/auth/:path*", "/admin/:path*", "/api/admin/:path*", "/api/jobs/:path*"],
};
