/** Provider billing failures describe service readiness, never a customer's credits. */
export function publicProviderFailure(
  provider: string,
  upstreamStatus: number,
  reference: string,
  retryAfter?: string | null
) {
  const status =
    upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502;
  const aiBillingFailure =
    status === 402 && (provider === "OpenRouter" || provider === "Kimi Code");
  const rateLimited = status === 429;
  const retryAfterSeconds = rateLimited
    ? providerRetryAfterSeconds(retryAfter)
    : undefined;
  return {
    status: aiBillingFailure ? 503 : status,
    body: {
      error: aiBillingFailure
        ? `The AI service is temporarily unavailable due to a service billing issue. Contact support with reference ${reference}.`
        : rateLimited
          ? `The service is temporarily rate-limited. ${retryAfterSeconds !== undefined ? `Wait at least ${retryAfterSeconds} seconds before starting another request.` : "Please wait before starting another request."} No automatic retry was made.`
          : "REELassati could not complete this request. Retry once; if it continues, contact support.",
      reference,
      ...(rateLimited ? { code: "provider_rate_limited" } : {}),
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    },
  };
}

/** Only a bounded wait duration crosses the public boundary, never raw headers. */
export function providerRetryAfterSeconds(
  value?: string | null,
  now = Date.now()
): number | undefined {
  if (!value || value.length > 100) return;
  const seconds = /^\d{1,6}$/.test(value)
    ? Number(value)
    : /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
          value
        )
      ? Math.ceil((Date.parse(value) - now) / 1000)
      : NaN;
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 86_400)
    return seconds;
}
