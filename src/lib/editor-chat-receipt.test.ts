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
it("reports repositioned audio cues as sound work, without claiming picture cuts", () => {
  expect(
    editorChatReceipt(
      message([
        {
          kind: "edit",
          status: "completed",
          operation: { type: "move", targetClipIds: ["cue"] },
        } as EditorChatAction,
      ]),
      ui,
      [{ id: "cue", track: "audio" }] as never
    )
  ).toBe("Updated the sound.");
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
it("does not invent picture cuts from removed graphics or cues", () => {
  expect(
    editorChatReceipt(
      message([
        {
          kind: "edit",
          status: "completed",
          operation: { type: "delete", targetClipIds: ["old-card"] },
        } as EditorChatAction,
        {
          kind: "edit",
          status: "completed",
          operation: { type: "graphic" },
        } as EditorChatAction,
        {
          kind: "shared-media",
          status: "completed",
          insert: {},
          catalog: { kind: "audio" },
        } as EditorChatAction,
      ]),
      ui,
      []
    )
  ).toBe("Updated the graphics. Updated the sound.");
});
it("reports positioned text as graphics and keeps unfinished execution visible", () => {
  expect(
    editorChatReceipt(
      message(
        [
          {
            kind: "edit",
            status: "completed",
            operation: { type: "move", targetClipIds: ["card"] },
          } as EditorChatAction,
          { kind: "edit", status: "pending" },
        ],
        "running"
      ),
      ui,
      [{ id: "card", track: "overlay", graphic: {} }] as never
    )
  ).toBe("I'm working on your edit… Updated the graphics.");
});
