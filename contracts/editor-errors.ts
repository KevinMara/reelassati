/** Public copy is deliberately separate from provider diagnostics and receipts.
 * Also accepts persisted errors, so older conversations no longer expose internals. */
export function editorFailureMessage(error: unknown): string {
  const row =
    error && typeof error === "object"
      ? (error as {
          message?: unknown;
          status?: number;
          name?: string;
          reason?: unknown;
        })
      : undefined;
  const text =
    typeof error === "string"
      ? error
      : typeof row?.message === "string"
        ? row.message
        : "";
  // Messages are sanitized when saved and again when old chat history renders.
  // Keep that projection idempotent; an edit failure is not a service outage.
  const publicMessages = [
    "Please sign in again to continue.",
    "You need more credits to continue.",
    "Your edit changed. Please try again with the current timeline.",
    "Reel couldn't read the audio. Please try again.",
    "Reel couldn't finish this edit. Please try again.",
    "Reel is unavailable right now. Please try again.",
    "Reel is temporarily busy. Wait before sending your request again.",
    "Reel is paused by a service billing issue. Please contact support.",
  ];
  if (publicMessages.includes(text)) return text;
  // Provider credit belongs to the service, not the customer's Reel balance.
  // Preserve the actionable category through saving and rendering chat history.
  if (
    row?.reason === "provider_billing_unavailable" ||
    /service billing issue/i.test(text)
  )
    return "Reel is paused by a service billing issue. Please contact support.";
  if (row?.status === 429 || /temporarily rate-limited/i.test(text))
    return "Reel is temporarily busy. Wait before sending your request again.";
  if (
    row?.status === 401 ||
    /sign in|session.*expired|not authenticated/i.test(text)
  )
    return "Please sign in again to continue.";
  if (
    row?.status === 402 ||
    /insufficient credits|not enough credits/i.test(text)
  )
    return "You need more credits to continue.";
  if (
    /timeline changed|project changed|workspace changed|account or brand changed/i.test(
      text
    )
  )
    return "Your edit changed. Please try again with the current timeline.";
  if (/speech|transcri|word timing|decodable audio/i.test(text))
    return "Reel couldn't read the audio. Please try again.";
  if (
    row?.reason === "edit_plan_invalid" ||
    /edit plan.*(?:executable timeline checks|incomplete)|AI edit needs correction/i.test(
      text
    )
  )
    return "Reel couldn't finish this edit. Please try again.";
  return "Reel is unavailable right now. Please try again.";
}
