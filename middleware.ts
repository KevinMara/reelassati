import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET || "default-secret-change-me-in-production";
const key = new TextEncoder().encode(SECRET);

export async function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;

  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");
  const isProtectedPage = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/app");

  if (isProtectedPage) {
    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    try {
      await jwtVerify(session, key, { algorithms: ["HS256"] });
      return NextResponse.next();
    } catch (e) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  if (isAuthPage && session) {
    try {
      await jwtVerify(session, key, { algorithms: ["HS256"] });
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch (e) {
      // Session invalid, continue to auth page
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/app/:path*", "/auth/:path*"],
};
