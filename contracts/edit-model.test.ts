import { expect, it } from "vitest";
import { editModel, editReasoningEffort } from "./edit-model";
it("keeps editing on K3 including legacy saved Pro requests", () => {
  expect(editModel(undefined)).toBe("moonshotai/kimi-k3");
  expect(editModel("moonshotai/kimi-k3.1-pro")).toBe("moonshotai/kimi-k3");
  expect(() => editModel("random/model")).toThrow();
  expect(editReasoningEffort("max")).toBe("high");
  expect(editReasoningEffort("balanced")).toBe("low");
});
