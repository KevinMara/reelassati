import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = cookies().get("google_oauth_state")?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/auth/login?error=invalid_state", request.url)
    );
  }

  cookies().delete("google_oauth_state");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL("/auth/login?error=google_not_configured", request.url)
    );
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("Google token error:", tokens.error);
      return NextResponse.redirect(
        new URL("/auth/login?error=google_auth_failed", request.url)
      );
    }

    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    const googleUser = await userResponse.json();

    if (!googleUser.email) {
      return NextResponse.redirect(
        new URL("/auth/login?error=no_email", request.url)
      );
    }

    const email = googleUser.email.toLowerCase();
    
    let user = await prisma.userProfile.findUnique({
      where: { email },
    });

    if (user) {
      user = await prisma.userProfile.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.sub,
          avatarUrl: googleUser.picture,
          displayName: user.displayName || googleUser.name,
        },
      });
    } else {
      user = await prisma.userProfile.create({
        data: {
          email,
          displayName: googleUser.name,
          googleId: googleUser.sub,
          avatarUrl: googleUser.picture,
          authProvider: "google",
        },
      });
    }

    await createSession(user.id);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      new URL("/auth/login?error=server_error", request.url)
    );
  }
}
