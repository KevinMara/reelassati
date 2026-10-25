import { expect, it } from "vitest";
import { editModel, editReasoningEffort } from "./edit-model";
it("keeps K3 as the default and permits only the requested comparison model",()=>{
  expect(editModel(undefined)).toBe("moonshotai/kimi-k3");
  expect(editModel("moonshotai/kimi-k3.1-pro")).toBe("moonshotai/kimi-k3.1-pro");
  expect(()=>editModel("random/model")).toThrow();
  expect(editReasoningEffort("max")).toBe("high");
  expect(editReasoningEffort("balanced")).toBe("low");
});
