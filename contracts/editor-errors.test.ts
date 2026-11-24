import { describe, expect, it } from "vitest";
import { editorFailureMessage, editorRateLimitRetryAt } from "./editor-errors";

describe("editor failure copy", () => {
  it("starts a new attempt only after a confirmed provider rejection", () => {
    expect(editorRateLimitRetryAt({ status: 429 }, 1000)).toBeUndefined();
    expect(
      editorRateLimitRetryAt(
        { status: 503, reason: "provider_rate_limited" },
        1000
      )
    ).toBeUndefined();
    const error = { status: 429, reason: "provider_rate_limited" };
    expect(
      editorRateLimitRetryAt({ ...error, retryAfterSeconds: 90 }, 1000)
    ).toBe(91000);
    expect(
      editorRateLimitRetryAt({ ...error, retryAfterSeconds: Infinity }, 1000)
    ).toBe(1000);
  });
  it.each([
    "The local model returned speech without usable word timings (word 2: start=0.5, end=0.5, source=0.26227083333333334s). No paid fallback was started.",
    "The review proposed edits that could not be safely prepared. (422) · Reference: a010e3bc-305e",
    "The service is temporarily rate-limited. Wait at least 1 seconds. (429)",
    new Error("secret response from upstream"),
  ])("does not show provider diagnostics or invent a credit refund", error => {
    expect(editorFailureMessage(error)).not.toMatch(
      /word 2|source=|fallback|422|429|Reference|secret|credits/i
    );
    expect(editorFailureMessage(error).length).toBeLessThan(90);
  });
  it("keeps useful recovery instructions", () => {
    expect(editorFailureMessage({ status: 401 })).toContain("sign in");
    expect(editorFailureMessage({ status: 402 })).toContain("credits");
    expect(
      editorFailureMessage(
        "The timeline changed while this action was running."
      )
    ).toContain("current timeline");
  });
  it("preserves a capacity failure through saved chat history without billing claims", () => {
    const expected =
      "Reel is temporarily busy. Wait before sending your request again.";
    for (const error of [
      { status: 429, message: "PRIVATE upstream body" },
      new Error(
        "The service is temporarily rate-limited. Wait at least 90 seconds before starting another request. No automatic retry was made."
      ),
      expected,
    ]) {
      expect(editorFailureMessage(error)).toBe(expected);
      expect(editorFailureMessage(editorFailureMessage(error))).toBe(expected);
    }
  });
  it("does not tell customers to buy credits or retry a service billing failure", () => {
    const expected =
      "Reel is paused by a service billing issue. Please contact support.";
    for (const error of [
      {
        status: 503,
        reason: "provider_billing_unavailable",
        message: "private upstream detail",
      },
      new Error(
        "The AI service is temporarily unavailable due to a service billing issue. Contact support with reference private-reference."
      ),
      expected,
    ]) {
      const copy = editorFailureMessage(error);
      expect(copy).toBe(expected);
      expect(copy).not.toMatch(/private|credits|try again/i);
      expect(editorFailureMessage(copy)).toBe(expected);
    }
  });
  it.each([
    { status: 401 },
    { status: 402 },
    new Error("The timeline changed"),
    new Error("Invalid speech timing"),
    { reason: "edit_plan_invalid" },
    new Error("upstream unavailable"),
  ])(
    "preserves public error meaning when saved history is rendered again",
    error => {
      const publicText = editorFailureMessage(error);
      expect(editorFailureMessage(publicText)).toBe(publicText);
    }
  );
  it("distinguishes a rejected plan from a service outage without diagnostics", () => {
    const expected = "Reel couldn't finish this edit. Please try again.";
    expect(
      editorFailureMessage({
        reason: "edit_plan_invalid",
        status: 422,
        message: "private provider payload",
      })
    ).toBe(expected);
    expect(
      editorFailureMessage(
        "The edit plan could not pass the executable timeline checks. No edit was applied."
      )
    ).toBe(expected);
    expect(
      editorFailureMessage({ status: 503, message: "upstream unavailable" })
    ).not.toBe(expected);
  });
});
