import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

function getKey(): Uint8Array {
  const SECRET = process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET;
  if (!SECRET) {
    // Return a fallback only to prevent crashing during key generation in build time
    // but actual runtime calls should fail if secret is missing.
    return new TextEncoder().encode("emergency-fallback-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(SECRET);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    console.error("Bcrypt compare failed:", e);
    return false;
  }
}

export async function encrypt(payload: any) {
  const secret = process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET;
  if (!secret) {
    console.error("AUTH_SECRET or INTERNAL_AGENT_SECRET is not configured.");
    throw new Error("auth_not_configured");
  }
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getKey());
}

export async function decrypt(input: string): Promise<any> {
  const secret = process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(input, getKey(), {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (e) {
    // Only log error in development or if it's not an expired token
    if (process.env.NODE_ENV === "development") {
      console.error("JWT decryption failed:", e);
    }
    return null;
  }
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await encrypt({ userId, expires });

  cookies().set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function getSession() {
  const session = cookies().get("session")?.value;
  if (!session) return null;
  return await decrypt(session);
}

export function deleteSession() {
  cookies().set("session", "", { 
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0) 
  });
}
