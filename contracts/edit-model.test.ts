import { expect, it } from "vitest";
import { editModel, editPlanOutputTokens, editReasoningEffort } from "./edit-model";
it("keeps editing on K3 including legacy saved Pro requests", () => {
  expect(editModel(undefined)).toBe("moonshotai/kimi-k3");
  expect(editModel("moonshotai/kimi-k3.1-pro")).toBe("moonshotai/kimi-k3");
  expect(() => editModel("random/model")).toThrow();
  expect(editReasoningEffort("max")).toBe("high");
  expect(editReasoningEffort("balanced")).toBe("low");
});
it("reserves room for the actual timeline, including dense short edits and maximum effort", () => {
  const single = editPlanOutputTokens(5, 1, 28.4, "balanced");
  expect(single).toBe(9_984);
  expect(editPlanOutputTokens(5, 1, 28.4, "max")).toBeGreaterThan(single);
  expect(editPlanOutputTokens(60, 1, 28.4, "balanced")).toBe(24_000);
  expect(editPlanOutputTokens(2, 70, 12, "balanced")).toBe(24_000);
  expect(editPlanOutputTokens(1, 1, 1800, "balanced")).toBe(24_000);
});
