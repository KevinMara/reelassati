import { expect, it } from "vitest";
import type {
  EditorChatMessage,
  EditorChatAction,
} from "@contracts/editor-chat";
import { editorChatReceipt } from "./editor-chat-receipt";
const ui = (text: string) => text;
const message = (actions: Partial<EditorChatAction>[], status = "completed") =>
  ({
    text: "Add an impressive callout",
    status,
    plan: { actions },
  }) as unknown as EditorChatMessage;
it("reports executed graphics instead of displaying an imperative proposal", () => {
  expect(
    editorChatReceipt(
      message([
        {
          kind: "edit",
          status: "completed",
          operation: { type: "graphic" },
        } as EditorChatAction,
      ]),
      ui
    )
  ).toBe("Updated the graphics.");
});
it("does not describe pending work as completed", () => {
  expect(
    editorChatReceipt(
      message([{ kind: "edit", status: "running" }], "running"),
      ui
    )
  ).toBe("I'm working on your edit…");
});
it("discloses a partial result and asks only for pending extras", () => {
  const done = { kind: "transcribe", status: "completed" } as const;
  expect(
    editorChatReceipt(message([done, { status: "blocked" }]), ui)
  ).toContain("Some steps could not finish");
  expect(
    editorChatReceipt(message([done, { status: "awaiting-approval" }]), ui)
  ).toContain("Would you like me");
});
it("leaves advice without an execution plan alone", () => {
  expect(
    editorChatReceipt(
      { text: "Try a stronger opening" } as EditorChatMessage,
      ui
    )
  ).toBeUndefined();
});
