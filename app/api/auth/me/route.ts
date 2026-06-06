import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log("[AUTH-ME] Check called");

    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ ok: false, user: null });
    }

    const results: any[] = await prisma.$queryRaw`
      SELECT 
        id::text, email, display_name, avatar_url, auth_provider,
        is_owner, is_unlimited, monthly_api_budget_eur, api_spend_this_cycle_eur, status
      FROM users_profile
      WHERE id = ${session.userId}::uuid
      LIMIT 1;
    `;

    const user = results[0];

    if (!user) {
      // Session exists but user doesn't - session is orphaned
      return NextResponse.json({ ok: false, user: null });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        auth_provider: user.auth_provider,
        is_owner: user.is_owner,
        is_unlimited: user.is_unlimited,
        monthly_api_budget_eur: user.monthly_api_budget_eur,
        api_spend_this_cycle_eur: user.api_spend_this_cycle_eur,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ ok: false, user: null });
  }
}
