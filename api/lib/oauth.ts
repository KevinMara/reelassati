import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";

const JWT_SECRET = new TextEncoder().encode(
  process.env.APP_SECRET || "reelassati-local-secret-key-change-in-production"
);

export const JWT_EXPIRY = "7d";

// ── Token Creation ───────────────────────────────────────────────────────────
export async function createToken(payload: {
  userId: number;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT({
    sub: String(payload.userId),
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

// ── Token Verification ───────────────────────────────────────────────────────
export async function verifyToken(
  token: string
): Promise<{ userId: number; email: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      clockTolerance: 60,
    });
    return {
      userId: Number(payload.sub),
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

// ── Google OAuth URL Builder ─────────────────────────────────────────────────
export function getGoogleAuthUrl(redirectUri: string): string {
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID || "";
  const state = btoa(redirectUri); // encode redirect as state

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Google Token Exchange ────────────────────────────────────────────────────
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
} | null> {
  try {
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();

    // Fetch user info with access token
    const userRes = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`
    );
    if (!userRes.ok) return null;
    const userData = await userRes.json();

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
    };
  } catch {
    return null;
  }
}

// ── User Lookup / Create ─────────────────────────────────────────────────────
export async function findOrCreateGoogleUser(googleUser: {
  id: string;
  email: string;
  name: string;
  picture?: string;
}): Promise<typeof users.$inferSelect> {
  const db = getDb();

  // Check if user exists by googleId
  const existingByGoogle = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleUser.id))
    .limit(1);

  if (existingByGoogle[0]) return existingByGoogle[0];

  // Check if user exists by email (migration path)
  const existingByEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, googleUser.email))
    .limit(1);

  if (existingByEmail[0]) {
    // Update with googleId
    await db
      .update(users)
      .set({
        googleId: googleUser.id,
        authProvider: "google",
        avatar: googleUser.picture || existingByEmail[0].avatar,
      })
      .where(eq(users.id, existingByEmail[0].id));

    return { ...existingByEmail[0], googleId: googleUser.id, authProvider: "google" as const };
  }

  // Create new user
  const result = await db.insert(users).values({
    name: googleUser.name,
    email: googleUser.email,
    googleId: googleUser.id,
    authProvider: "google",
    avatar: googleUser.picture,
    role: "editor",
    subscription: "free",
    credits: 100,
    language: "en",
    timezone: "Europe/Rome",
    onboardingCompleted: false,
  });

  const newUser = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(result[0].insertId)))
    .limit(1);

  return newUser[0];
}
