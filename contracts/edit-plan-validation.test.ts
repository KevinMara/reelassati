import { describe, expect, it } from "vitest";
import {
  EditPlanValidationError,
  editPlanValidationDiagnostic,
  type EditPlanValidationStage,
  type EditPlanValidationReason,
} from "./edit-plan-validation";
import type { EditOperation } from "./workspace";

describe("bounded edit-plan validation diagnostics", () => {
  it("projects explicit finite codes and operation coordinates without error text", () => {
    const error = new EditPlanValidationError(
      "timing_conflict",
      "PRIVATE prompt and https://private.example/token",
      2,
      "style"
    );
    Object.assign(error, {
      cause: { token: "PRIVATE credential" },
      label: "PRIVATE label",
    });
    expect(editPlanValidationDiagnostic(error, "references", 4)).toEqual({
      version: 1,
      stage: "references",
      reason: "timing_conflict",
      operationCount: 4,
      operationIndex: 2,
      operationType: "style",
    });
  });

  it("never infers a reason from arbitrary error messages or forged error fields", () => {
    for (const error of [
      new Error("timing_conflict PRIVATE"),
      {
        reason: "timing_conflict",
        operationIndex: 1,
        operationType: "style",
        message: "PRIVATE",
      },
    ]) {
      expect(editPlanValidationDiagnostic(error, "composition", 2)).toEqual({
        version: 1,
        stage: "composition",
        reason: "validation_failed",
        operationCount: 2,
      });
    }
  });

  it("bounds runtime values and omits unknown operation names and reason codes", () => {
    const invalid = new EditPlanValidationError(
      "PRIVATE" as EditPlanValidationReason,
      "PRIVATE",
      Infinity,
      "PRIVATE" as EditOperation["type"]
    );
    expect(
      editPlanValidationDiagnostic(
        invalid,
        "PRIVATE" as EditPlanValidationStage,
        Infinity
      )
    ).toEqual({
      version: 1,
      stage: "normalization",
      reason: "validation_failed",
      operationCount: 0,
    });
    expect(
      editPlanValidationDiagnostic(
        new EditPlanValidationError(
          "unsupported_operation",
          "PRIVATE",
          -1,
          "PRIVATE" as EditOperation["type"]
        ),
        "references",
        1000000
      )
    ).toEqual({
      version: 1,
      stage: "references",
      reason: "unsupported_operation",
      operationCount: 10000,
    });
  });
});
