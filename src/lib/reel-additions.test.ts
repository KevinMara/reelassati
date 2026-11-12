import { describe, expect, it } from "vitest";
import type { EditorChatMessage } from "@contracts/editor-chat";
import { nextReelAddition, type ReelAddition } from "./reel-additions";
describe("foreground additions", () => {
  const messages = (status: EditorChatMessage["status"]) =>
    [{ id: "parent", status }] as EditorChatMessage[];
  it("waits for the current operation then consumes each submitted addition exactly once", () => {
    const queue: ReelAddition[] = [
      { id: "a", parentId: "parent" },
      { id: "b", parentId: "parent" },
    ];
    expect(nextReelAddition(queue, messages("running"))).toBeUndefined();
    expect(queue).toHaveLength(2);
    expect(nextReelAddition(queue, messages("completed"))?.id).toBe("a");
    expect(nextReelAddition(queue, messages("completed"))?.id).toBe("b");
    expect(nextReelAddition(queue, messages("completed"))).toBeUndefined();
  });
  it.each(["failed", "stopped", "partial"] as const)(
    "does not launch another model request after %s",
    status => {
      const queue = [{ id: "a", parentId: "parent" }];
      expect(nextReelAddition(queue, messages(status))).toBeUndefined();
      expect(queue).toHaveLength(0);
    }
  );
  it("waits when the parent needs the user's approval", () => {
    const queue = [{ id: "a", parentId: "parent" }];
    expect(nextReelAddition(queue, messages("ready"))).toBeUndefined();
    expect(queue).toHaveLength(1);
  });
  it("does not reconstruct work from saved requests after a reload", () => {
    expect(
      nextReelAddition([], [
        { id: "saved", request: { prompt: "do something" } },
      ] as EditorChatMessage[])
    ).toBeUndefined();
  });
});
