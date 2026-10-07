import { describe, expect, it } from "vitest";
import { publicProviderFailure } from "./provider-failure";

const reference = "5ce76747-7f8c-40af-9b3d-961141276874";

describe("public provider failures", () => {
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
