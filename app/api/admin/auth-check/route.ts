import { NextResponse } from "next/server";

export async function GET() {
  const googleAuth = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  const sessionSecretConfigured = !!(process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET);

  return NextResponse.json({
    ok: true,
    auth: {
      configured: true,
      passwordAuth: true,
      googleAuth,
      sessionSecretConfigured
    },
  });
}
