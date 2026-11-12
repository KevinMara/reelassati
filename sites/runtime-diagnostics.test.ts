import { describe, expect, it } from "vitest";
import { runtimeFailureDiagnostic } from "./runtime-diagnostics";
describe("runtime diagnostics", () => {
  it("classifies infrastructure failures without retaining their sensitive text", () => {
    const value = runtimeFailureDiagnostic(
      new Error("D1_ERROR: query PRIVATE_EMAIL no such column: SECRET_TOKEN")
    );
    expect(value).toEqual({ category: "database-schema", errorType: "Error" });
    expect(JSON.stringify(value)).not.toMatch(/PRIVATE|SECRET/);
  });
  it("does not expose custom error names or unknown messages", () => {
    const error = new Error("Bearer SECRET");
    error.name = "PRIVATE_URL";
    expect(runtimeFailureDiagnostic(error)).toEqual({
      category: "unclassified",
      errorType: "Error",
    });
  });
});
