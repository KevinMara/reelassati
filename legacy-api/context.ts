import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { verifyToken } from "./lib/oauth";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  session: { userId?: string; email?: string; name?: string } | null;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  // Try JWT from Authorization header first
  const authHeader = opts.req.headers.get("authorization");
  let token = authHeader?.replace("Bearer ", "");

  // Fallback: check cookie
  if (!token) {
    const cookieHeader = opts.req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  // Fallback: legacy x-auth-user headers
  const userId = opts.req.headers.get("x-auth-user-id");
  const email = opts.req.headers.get("x-auth-email");

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      return {
        req: opts.req,
        resHeaders: opts.resHeaders,
        session: {
          userId: String(payload.userId),
          email: payload.email,
          name: payload.name,
        },
      };
    }
  }

  // Legacy header-based auth (fallback for local auth)
  if (userId) {
    return {
      req: opts.req,
      resHeaders: opts.resHeaders,
      session: { userId, email: email || undefined },
    };
  }

  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
    session: null,
  };
}
