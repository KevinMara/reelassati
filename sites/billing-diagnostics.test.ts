import { describe, expect, it } from "vitest";
import { redactBillingError } from "./billing-diagnostics";

describe("billing diagnostics", () => {
  it("retains provider explanations without request values", () => {
    expect(redactBillingError("Managed Payments must be enabled in your Dashboard.")).toBe("Managed Payments must be enabled in your Dashboard.");
    const result = redactBillingError('Invalid customer cus_example for test@example.com using rk_live_fixture at https://example.com/private: "personal value" 123456789');
    for (const value of ["cus_example", "test@example.com", "rk_live_fixture", "https://example.com", "personal value", "123456789"]) expect(result).not.toContain(value);
  });
  it("ignores nontext data and bounds log size", () => {
    expect(redactBillingError({secret: true})).toBeUndefined();
    expect(redactBillingError("x".repeat(2000))).toHaveLength(1000);
  });
});
