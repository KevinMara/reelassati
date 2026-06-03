import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "reelassati_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: string;
  email: string;
  display_name?: string | null;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET;
  if (!secret) throw new Error("missing_session_secret");
  return new TextEncoder().encode(secret);
}

export function hasSessionSecret() {
  return Boolean(process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    email: user.email,
    display_name: user.display_name || null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function readSessionToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || !payload.email) return null;

    return {
      id: String(payload.sub),
      email: String(payload.email),
      display_name: payload.display_name ? String(payload.display_name) : null,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  };
}
