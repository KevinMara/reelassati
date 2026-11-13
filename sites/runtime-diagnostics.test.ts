import { describe, expect, it } from "vitest";
import { runtimeFailureDiagnostic } from "./runtime-diagnostics";
describe("runtime diagnostics", () => {
  it("distinguishes a truncated completion from a broken stream with fixed values only", () => {
    expect(runtimeFailureDiagnostic(new Error("Analysis provider output limit reached"))).toEqual({
      category: "provider-stream", providerCheck: "output-limit", errorType: "Error",
    });
    expect(runtimeFailureDiagnostic(new Error("Analysis provider response is incomplete"))).toEqual({
      category: "provider-stream", providerCheck: "incomplete-stream", errorType: "Error",
    });
    expect(JSON.stringify(runtimeFailureDiagnostic(new Error("Analysis provider stream failed SECRET")))).not.toContain("SECRET");
  });
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
  it("identifies a catalog validation gate without exposing asset content", () => {
    expect(runtimeFailureDiagnostic(new Error("A still image cannot establish motion."))).toEqual({
      category: "catalog-observation", catalogCheck: "still-motion", errorType: "Error",
    });
    const unknown = runtimeFailureDiagnostic(new Error("Invalid visual observation. PRIVATE_SOURCE_COPY"));
    expect(unknown).toEqual({ category: "unclassified", errorType: "Error" });
  });
});
