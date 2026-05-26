import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { ok: false, error: "google_oauth_not_configured" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  
  // Store state in a cookie for validation in the callback
  cookies().set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "select_account",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ].join(" "),
    state: state,
  };

  const qs = new URLSearchParams(options);
  return NextResponse.redirect(`${rootUrl}?${qs.toString()}`);
}
