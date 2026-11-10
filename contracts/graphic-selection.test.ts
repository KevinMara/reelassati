import { describe, expect, it } from "vitest";
import { graphicSelectionBounds } from "./graphic-selection";
import { graphicCardLayout } from "./graphic-layout";
import { normalizeGraphic } from "./motion-graphics";
import type { TimelineClip } from "./workspace";

const clip = (
  graphic: Record<string, unknown>,
  extra: Partial<TimelineClip> = {}
): TimelineClip =>
  ({
    id: "graphic",
    label: "Graphic",
    assetId: "graphic",
    track: "overlay",
    start: 2,
    duration: 4,
    inPoint: 0,
    outPoint: 4,
    graphic: normalizeGraphic({ animation: "none", x: 50, y: 50, ...graphic }),
    ...extra,
  }) as TimelineClip;

describe("preview graphic selection", () => {
  it("bounds the actual auto-sized card including secondary copy", () => {
    const c = clip({
      kind: "callout",
      text: "Hello",
      secondaryText: "Supporting words",
      padding: 2,
      size: 5,
    });
    const layout = graphicCardLayout("Hello", 5, 2, "Supporting words");
    const bounds = graphicSelectionBounds(c, 3, 1000, 1600)!;
    expect(bounds.width).toBeCloseTo(layout.width * 10);
    expect(bounds.height).toBeCloseTo(layout.height * 10);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(800 + layout.centerY * 10);
    expect(bounds.width).toBeLessThan(1000);
  });

  it("uses source trim and speed for animated graphic positions", () => {
    const graphic = {
      kind: "rectangle",
      width: 20,
      height: 10,
      motion: [
        { at: 0, x: 20, y: 20, scale: 1, rotation: 0 },
        { at: 1, x: 80, y: 80, scale: 2, rotation: 90 },
      ],
    };
    const trimmed = clip(graphic, { inPoint: 1, speed: 2, graphicDuration: 8 });
    const original = clip(graphic, { graphicDuration: 8 });
    expect(graphicSelectionBounds(trimmed, 3, 1000, 1000)).toEqual(
      graphicSelectionBounds(original, 5, 1000, 1000)
    );
  });

  it("gives video, hidden and inactive clips no selection frame", () => {
    const c = clip({ kind: "text", text: "Hello" });
    expect(
      graphicSelectionBounds(
        { ...c, graphic: undefined, track: "video" },
        3,
        1000,
        1000
      )
    ).toBeUndefined();
    expect(
      graphicSelectionBounds({ ...c, hidden: true }, 3, 1000, 1000)
    ).toBeUndefined();
    expect(graphicSelectionBounds(c, 6, 1000, 1000)).toBeUndefined();
  });

  it("bounds shared highlight strokes with explicit controls and legacy aspect defaults", () => {
    const legacy = clip({ kind: "highlight", text: "" });
    const legacyBounds = graphicSelectionBounds(legacy, 3, 720, 1280)!;
    expect(legacyBounds.width).toBeCloseTo(720 * 0.4042);
    expect(legacyBounds.height).toBeCloseTo(1280 * 0.15 + 720 * 0.0042);
    const explicit = clip({
      kind: "highlight",
      text: "",
      width: 30,
      height: 20,
      strokeWidth: 4,
    });
    const bounds = graphicSelectionBounds(explicit, 3, 720, 1280)!;
    expect(bounds.width).toBeCloseTo(720 * 0.34);
    expect(bounds.height).toBeCloseTo(720 * 0.24);
    explicit.graphic!.rotation = 90;
    const rotated = graphicSelectionBounds(explicit, 3, 720, 1280)!;
    expect(rotated.width).toBeCloseTo(bounds.height);
    expect(rotated.height).toBeCloseTo(bounds.width);
    explicit.graphic!.strokeWidth = 0;
    expect(graphicSelectionBounds(explicit, 3, 720, 1280)).toBeUndefined();
  });

  it("bounds projected 3D faces, not the full square SVG", () => {
    const bounds = graphicSelectionBounds(
      clip({ kind: "spatial-cube" }),
      3,
      1000,
      1600
    )!;
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.width).toBeLessThan(1000);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.height).toBeLessThan(1000);
  });
});
