/** Server-only diagnostic text. Never include raw request payloads or secrets. */
export function redactBillingError(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/\b(?:[sr]k|whsec|cs|cus|pi|sub|price|prod|acct|tok|pm)_[A-Za-z0-9_]+\b/g, "[redacted]")
    .replace(/https?:\/\/[^\s)]+/g, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/"[^"\n]*"|'[^'\n]*'/g, "[quoted value]")
    .replace(/\b\d{6,}\b/g, "[number]")
    .replace(/[\r\n\t]/g, " ")
    .slice(0, 1000);
}
