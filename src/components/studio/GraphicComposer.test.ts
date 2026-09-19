import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { GraphicComposer } from "./GraphicComposer";

describe("graphic preset drafts", () => {
  it("keeps new presets editable until an explicit insertion", () => {
    const draft = normalizeGraphic({
      kind: "callout",
      text: "Review this draft",
    })!;
    let saves = 0;
    const html = renderToStaticMarkup(
      createElement(GraphicComposer, {
        draft,
        duration: 5,
        onSave: async () => {
          saves++;
        },
      })
    );
    expect(html).toContain("Review this draft");
    expect(html).toContain("Duration · 5.0s");
    expect(html).toContain("Add at playhead");
    expect(html).not.toContain("Save graphic");
    expect(saves).toBe(0);
  });
  it("preserves the existing-clip save action and its timeline duration", () => {
    const initial = normalizeGraphic({ kind: "text", text: "Existing title" })!;
    const html = renderToStaticMarkup(
      createElement(GraphicComposer, {
        initial,
        duration: 4,
        onSave: async () => undefined,
      })
    );
    expect(html).toContain("Save graphic");
    expect(html).not.toContain("Add at playhead");
    expect(html).not.toContain("Duration ·");
  });
});
