import { describe, expect, it } from "vitest";
import { editorChatTargetContext } from "./editor-chat-target";

describe("chat interval targeting", () => {
  it("targets a section without restricting it to a previously selected clip", () => {
    const context = editorChatTargetContext(
      { range: { start: 10, end: 20 }, section: { id: "body", label: "Body" } },
      "old-hook-clip"
    );
    expect(context.selectedClipIds).toBeUndefined();
    expect(context.range).toEqual({ start: 10, end: 20 });
    expect(context.sectionReference).toEqual({
      name: "Body",
      text: JSON.stringify({
        timelineSection: { id: "body", label: "Body", start: 10, end: 20 },
      }),
    });
  });
  it("replaces section context when the user chooses an ordinary time range", () => {
    const context = editorChatTargetContext(
      { range: { start: 2, end: 5 } },
      "old-clip"
    );
    expect(context.sectionReference).toBeUndefined();
    expect(context.selectedClipIds).toBeUndefined();
    expect(context.range).toEqual({ start: 2, end: 5 });
  });
  it("removes both section evidence and bounds when the target is cleared", () => {
    expect(editorChatTargetContext(undefined, "clip")).toEqual({
      range: undefined,
      sectionReference: undefined,
      selectedClipIds: ["clip"],
    });
  });
});
