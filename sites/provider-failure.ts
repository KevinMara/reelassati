/** Provider billing failures describe service readiness, never a customer's credits. */
export function publicProviderFailure(
  provider: string,
  upstreamStatus: number,
  reference: string
) {
  const status =
    upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502;
  const aiBillingFailure =
    status === 402 && (provider === "OpenRouter" || provider === "Kimi Code");
  return {
    status: aiBillingFailure ? 503 : status,
    body: {
      error: aiBillingFailure
        ? `The AI service is temporarily unavailable due to a service billing issue. Contact support with reference ${reference}.`
        : "REELassati could not complete this request. Retry once; if it continues, contact support.",
      reference,
    },
  };
}
