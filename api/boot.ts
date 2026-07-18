import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { setCookie, getCookie } from "hono/cookie";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  findOrCreateGoogleUser,
  createToken,
  verifyToken,
} from "./lib/oauth";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// ═══════════════════════════════════════════════════════════════════════════════
// Google OAuth Routes
// ═══════════════════════════════════════════════════════════════════════════════

// Initiate Google OAuth — return the auth URL for the frontend
app.get("/api/auth/google", (c) => {
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/google/callback`;
  const authUrl = getGoogleAuthUrl(redirectUri);
  return c.json({ authUrl });
});

// Google OAuth callback
app.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");
  const origin = new URL(c.req.url).origin;

  if (error || !code) {
    return c.redirect(`/?auth_error=${error || "no_code"}`);
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const googleUser = await exchangeGoogleCode(code, redirectUri);

    if (!googleUser) {
      return c.redirect("/?auth_error=google_failed");
    }

    // Find or create user in database
    const user = await findOrCreateGoogleUser(googleUser);

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Set token in cookie (httpOnly for security)
    setCookie(c, "auth_token", token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Also pass token in URL for client-side storage (SPA needs this)
    return c.redirect(`/auth/oauth-success?token=${token}`);
  } catch {
    return c.redirect("/?auth_error=server_error");
  }
});

// Verify token endpoint (used by frontend to validate)
app.get("/api/auth/me", async (c) => {
  const token =
    getCookie(c, "auth_token") ||
    c.req.header("authorization")?.replace("Bearer ", "");

  if (!token) return c.json({ user: null }, 401);

  const payload = await verifyToken(token);
  if (!payload) return c.json({ user: null }, 401);

  // Get fresh user data from DB
  const db = (await import("./queries/connection")).getDb();
  const { users } = await import("@db/schema");
  const { eq } = await import("drizzle-orm");

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  const user = userRows[0];
  if (!user) return c.json({ user: null }, 401);

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      subscription: user.subscription,
      credits: user.credits,
      onboardingCompleted: user.onboardingCompleted,
      language: user.language,
    },
  });
});

// Logout — clear cookie
app.post("/api/auth/logout", (c) => {
  setCookie(c, "auth_token", "", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Zernio OAuth Callback
// ═══════════════════════════════════════════════════════════════════════════════
// This endpoint receives the redirect from the social platform after the user
// authorizes REELassati. Zernio handles the token exchange; we just need to
// store the resulting account ID in our database.

app.get("/api/zernio/callback", async (c) => {
  const code = c.req.query("code");
  const requestId = c.req.query("request_id");
  const error = c.req.query("error");
  const userId = c.req.query("user_id");

  if (error || !code || !requestId || !userId) {
    return c.redirect("/dashboard/social?connect_error=1");
  }

  try {
    const { handleCallback } = await import("./lib/zernio");
    const result = await handleCallback(requestId, code);

    if (!result) {
      return c.redirect("/dashboard/social?connect_error=1");
    }

    // Store the connection in our database
    const db = (await import("./queries/connection")).getDb();
    const { platformConnections } = await import("@db/schema");
    const { eq, and } = await import("drizzle-orm");

    // Check if this account already exists
    const existing = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.userId, Number(userId)),
          eq(platformConnections.zernioAccountId, result.accountId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      // Update existing
      await db
        .update(platformConnections)
        .set({
          accountName: result.accountName,
          accountHandle: result.accountHandle,
          avatarUrl: result.avatarUrl,
          followers: result.followers || 0,
          status: "connected",
        })
        .where(eq(platformConnections.id, existing[0].id));
    } else {
      // Insert new
      await db.insert(platformConnections).values({
        userId: Number(userId),
        platform: result.platform as any,
        accountName: result.accountName,
        accountHandle: result.accountHandle,
        avatarUrl: result.avatarUrl,
        zernioAccountId: result.accountId,
        followers: result.followers || 0,
        status: "connected",
      });
    }

    return c.redirect("/dashboard/social?connect_success=1");
  } catch {
    return c.redirect("/dashboard/social?connect_error=1");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// tRPC Handler
// ═══════════════════════════════════════════════════════════════════════════════

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
