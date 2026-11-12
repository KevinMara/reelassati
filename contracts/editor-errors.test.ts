import { describe, expect, it } from "vitest";
import { editorFailureMessage } from "./editor-errors";

describe("editor failure copy", () => {
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
