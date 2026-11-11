import { describe, expect, it } from "vitest";
import { editorRunDiagnostic } from "./editor-run-diagnostic";

describe("editor run diagnostics", () => {
  it("keeps only bounded stage, status and category without private error content", () => {
    expect(
      editorRunDiagnostic("source-review", {
        status: 503,
        name: "private token",
        message: "private transcript",
        url: "private media",
        reference: "private account",
      })
    ).toEqual({
      stage: "source-review",
      status: 503,
      kind: "request-or-validation",
    });
    expect(
      editorRunDiagnostic(
        "activity-save",
        new TypeError("Failed to fetch secret URL")
      )
    ).toEqual({
      stage: "activity-save",
      status: null,
      kind: "transport-or-client",
    });
    expect(editorRunDiagnostic("planning", { status: Infinity })).toEqual({
      stage: "planning",
      status: null,
      kind: "request-or-validation",
    });
  });
});
