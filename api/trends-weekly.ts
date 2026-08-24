const PLATFORM_API_ORIGIN =
  process.env.PLATFORM_API_ORIGIN?.trim().replace(/\/$/, "") ||
  "https://reelassati.kevinbiz.chatgpt.site";

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function handleWeeklyTrendCron(
  request: Request
): Promise<Response> {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (
    cronSecret &&
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return json({ error: "Unauthorized" }, 401);
  }
  const oidcToken = request.headers.get("x-vercel-oidc-token")?.trim();
  if (request.headers.get("user-agent") !== "vercel-cron/1.0" || !oidcToken) {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const response = await fetch(
      `${PLATFORM_API_ORIGIN}/api/internal/trends/weekly`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oidcToken}`,
          "X-REELassati-Scheduler": "vercel-weekly",
        },
      }
    );
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "Weekly trend refresh unavailable" }, 502);
  }
}

export default { fetch: handleWeeklyTrendCron };
