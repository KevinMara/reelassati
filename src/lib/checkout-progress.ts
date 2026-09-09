type CheckoutResult = { checkoutUrl: string } | { status: "pending"; retryAfterMs?: number };

/** Retry only an explicitly pending checkout; real failures still surface. */
export async function waitForCheckout(
  request: () => Promise<CheckoutResult>
): Promise<{ checkoutUrl: string }> {
  const deadline = Date.now() + 150_000;
  for (;;) {
    const result = await request();
    if ("checkoutUrl" in result && result.checkoutUrl) return result;
    if (!("status" in result) || result.status !== "pending")
      throw new Error("Checkout did not return a payment link. Please try again.");
    if (Date.now() >= deadline)
      throw new Error("Checkout is taking longer than expected. Please try again.");
    const delay = Math.min(5000, Math.max(1000, result.retryAfterMs || 2000));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
