import { describe, expect, it } from "vitest";
import {
  publicProviderFailure,
  providerRetryAfterSeconds,
} from "./provider-failure";

const reference = "5ce76747-7f8c-40af-9b3d-961141276874";

describe("public provider failures", () => {
  it("identifies rate limiting without suggesting an immediate or automatic retry", () => {
    const failure = publicProviderFailure("OpenRouter", 429, reference, "90");
    expect(failure).toMatchObject({
      status: 429,
      body: { reference, code: "provider_rate_limited", retryAfterSeconds: 90 },
    });
    expect(failure.body.error).toContain("Wait at least 90 seconds");
    expect(failure.body.error).toContain("No automatic retry");
    expect(failure.body.error).not.toMatch(
      /Retry once|credits|refunded|Fireworks/i
    );
    expect(
      publicProviderFailure("OpenRouter", 429, reference).body.error
    ).toContain("Please wait");
  });
  it("accepts bounded standard retry durations and dates, dropping raw or invalid headers", () => {
    const now = Date.parse("2026-10-22T15:00:00Z");
    expect(
      providerRetryAfterSeconds("Thu, 22 Oct 2026 15:02:00 GMT", now)
    ).toBe(120);
    expect(providerRetryAfterSeconds("0", now)).toBe(0);
    for (const value of [
      "-1",
      "1.5",
      "86401",
      "999999999",
      "PRIVATE_TOKEN",
      "https://private.example",
      "Thu, 22 Oct 2026 14:59:59 GMT",
    ])
      expect(providerRetryAfterSeconds(value, now)).toBeUndefined();
  });
  it.each(["OpenRouter", "Kimi Code"])(
    "reports %s upstream billing rejection as service unavailability with a safe support reference",
    provider => {
      const failure = publicProviderFailure(provider, 402, reference);
      expect(failure.status).toBe(503);
      expect(failure.body.reference).toBe(reference);
      expect(failure.body.error).toContain("service billing issue");
      expect(failure.body.error).toContain(reference);
      expect(failure.body.error).not.toMatch(
        /credits|charged|refunded|api.?key|OpenRouter|Kimi/i
      );
    }
  );
  it("preserves other provider statuses and never treats an unrelated 402 as an AI failure", () => {
    expect(publicProviderFailure("Zernio", 402, reference).status).toBe(402);
    for (const status of [400, 401, 403, 429, 500])
      expect(
        publicProviderFailure("OpenRouter", status, reference).status
      ).toBe(status);
    expect(publicProviderFailure("OpenRouter", 200, reference).status).toBe(
      502
    );
  });
});
