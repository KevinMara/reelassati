import Stripe from "stripe";

// Match the SDK and webhook endpoint so account-default changes cannot alter billing.
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

export function hasStripeKey(value: string | undefined): boolean {
  return /^(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+$/.test(value?.trim() || "");
}

export function stripeClient(key: string): Stripe {
  if (!hasStripeKey(key)) throw new Error("Stripe API key is not configured");
  return new Stripe(key.trim(), {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    timeout: 15_000,
    maxNetworkRetries: 1,
    appInfo: { name: "REELassati", url: "https://reelassati.app" },
  });
}
