import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ColorPanel } from "./ColorPanel";
import type { TimelineClip } from "@contracts/workspace";
import { editorLutUi } from "@/lib/i18n/locales/ui-editor-lut";
vi.mock("@/lib/i18n/ui", () => ({ useUiText: () => (text: string) => text }));
describe("editable CUBE color controls", () => {
  it("shows the applied look, strength and removal inside the existing color panel", () => {
    const sha256 = "a".repeat(64);
    const clip = {
      id: "clip",
      label: "Footage",
      track: "video",
      locked: false,
      colorLut: {
        id: `stock-${sha256.slice(0, 24)}`,
        sha256,
        name: "Creative look",
        amount: 0.75,
      },
    } as TimelineClip;
    const html = renderToStaticMarkup(
      <ColorPanel
        clip={clip}
        disabled={false}
        onChange={async () => {}}
        onAssist={() => {}}
      />
    );
    expect(html).toContain("Creative look");
    expect(html).toContain("75%");
    expect(html).toContain('aria-label="Look strength"');
    expect(html).toContain('aria-label="Remove color look"');
    expect(html).toContain('aria-label="Reset color"');
  });
  it("provides all look-control and preview states in 28 locales", () => {
    expect(Object.keys(editorLutUi)).toHaveLength(28);
    for (const values of Object.values(editorLutUi)) {
      expect(Object.keys(values)).toEqual(Object.keys(editorLutUi.en));
      expect(Object.values(values).every(value => value.trim())).toBe(true);
    }
  });
});
