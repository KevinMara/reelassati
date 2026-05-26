import { NextResponse } from "next/server";

// Public endpoint: only exposes whether Google login is available so the
// login/signup pages can enable or disable the button. No other infra
// information is returned.
export async function GET() {
  const googleAuth = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  return NextResponse.json({
    ok: true,
    auth: {
      configured: true,
      passwordAuth: true,
      googleAuth,
    },
  });
}
