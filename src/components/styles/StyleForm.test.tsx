import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createEmptyWorkspace } from "@contracts/workspace";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { EditingLanguageFields } from "./EditingLanguageFields";
import { GraphicStyleFields } from "./GraphicStyleFields";
import { StyleSelect } from "./StyleFields";
import {
  newWorkspaceStyle,
  saveWorkspaceStyle,
  workspaceStyles,
} from "./style-workspace";

vi.mock("@/lib/i18n/ui", () => ({ useUiText: () => (text: string) => text }));

describe("saved style form browser constraints", () => {
  it("accepts measured sub-frame shot durations in the collapsed section without rounding the saved profile", () => {
    const draft = newWorkspaceStyle("editing", "measured-style");
    if (draft.kind !== "editing") throw new Error("Wrong fixture");
    draft.value.name = "Imported style";
    draft.value.profile.shotSeconds = {
      short: 28.350708,
      typical: 28.350708,
      long: 28.350708,
    };
    const changed = vi.fn();
    const html = renderToStaticMarkup(
      createElement(
        "form",
        null,
        createElement(EditingLanguageFields, {
          value: draft.value.profile,
          onChange: changed,
        })
      )
    );
    const inputs = html.match(/<input\b[^>]*type="number"[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(3);
    for (const input of inputs) {
      // HTML step="any" is necessary: a 0.1 step rejects the imported value,
      // preventing native form submission even while its details are collapsed.
      expect(input).toContain('step="any"');
      expect(input).toContain('value="28.350708"');
      expect(input).toContain('min="0.1"');
      expect(input).toContain('max="180"');
    }
    expect(changed).not.toHaveBeenCalled();
    const saved = saveWorkspaceStyle(
      createEmptyWorkspace("styles@example.com"),
      draft,
      "create"
    );
    const restored = workspaceStyles(JSON.parse(JSON.stringify(saved)))[0];
    expect(restored.value).toEqual(draft.value);
  });

  it("allows fractional counter endpoints captured from existing graphics", () => {
    const graphic = normalizeGraphic({
      kind: "counter",
      from: 1.25,
      to: 28.350708,
    })!;
    const html = renderToStaticMarkup(
      createElement(GraphicStyleFields, {
        value: {
          id: "counter",
          name: "Measured statistic",
          type: "graphic",
          graphic,
          graphicDuration: 3,
        },
        onChange: vi.fn(),
      })
    );
    const inputs = html.match(/<input\b[^>]*type="number"[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).toContain('step="any"');
    expect(inputs.join(" ")).toContain('value="1.25"');
    expect(inputs.join(" ")).toContain('value="28.350708"');
  });

  it("presents one option per source ID and keeps the canonical first record", () => {
    const html = renderToStaticMarkup(
      createElement(StyleSelect, {
        label: "Library / Projects",
        value: "asset:duplicate",
        onChange: vi.fn(),
        options: [
          { value: "", label: "Choose an example" },
          { value: "asset:duplicate", label: "Original Library record" },
          { value: "asset:duplicate", label: "Duplicate Library record" },
          { value: "project:duplicate", label: "Original project" },
          { value: "project:duplicate", label: "Duplicate project" },
        ],
      })
    );
    expect(html.match(/<option\b[^>]*value="asset:duplicate"/g)).toHaveLength(
      1
    );
    expect(html.match(/<option\b[^>]*value="project:duplicate"/g)).toHaveLength(
      1
    );
    expect(html).toContain("Original Library record");
    expect(html).not.toContain("Duplicate Library record");
    expect(html).not.toContain("Duplicate project");
  });
});
