import { describe, expect, it } from "vitest";
import {
  captureEditorStyle,
  addEditorSavedStyle,
  removeEditorSavedStyle,
  normalizeEditorSavedStyles,
  normalizeEditorSavedStyle,
} from "@contracts/editor-style-library";
import { normalizeGraphic, graphicFrame } from "@contracts/motion-graphics";
import { getCaptionPreset } from "@contracts/editor-presets";
import { normalizeVisual } from "@contracts/clip-visual";
import type { EditProject, TimelineClip } from "@contracts/workspace";
import { applyEditOperation } from "./edit-timeline";
import { graphicAssEvents } from "./graphic-ass";

const graphic = normalizeGraphic({
  kind: "callout",
  text: "Captured project title",
  secondaryText: "Editable secondary text",
  composition: "lower-third",
  color: "#FFFFFF",
  background: "#203040",
  accent: "#7AF5CF",
  animation: "none",
  padding: 2,
  cornerRadius: 1,
  motion: [
    { at: 0, x: 20, y: 70, scale: 1, rotation: 0, easing: "linear" },
    { at: 1, x: 80, y: 70, scale: 1.2, rotation: 5 },
  ],
})!;
const clip: TimelineClip = {
  id: "source-graphic",
  label: "Source graphic",
  track: "overlay",
  start: 5,
  duration: 2,
  inPoint: 4,
  outPoint: 6,
  graphicDuration: 6,
  graphic,
  locked: false,
  color: "#203040",
};

describe("captured editable editor styles", () => {
  it("round-trips the complete graphic animation and exports an independent editable copy", () => {
    const draft = captureEditorStyle("graphic", "  My title  ", clip, {}, 5.5);
    const saved = addEditorSavedStyle([], { id: "my-title", ...draft });
    const restored = normalizeEditorSavedStyles(
      JSON.parse(JSON.stringify(saved))
    );
    expect(restored).toEqual(saved);
    expect(restored[0]).toMatchObject({
      type: "graphic",
      name: "My title",
      graphicDuration: 6,
      graphic,
    });
    const style = restored[0];
    if (style.type !== "graphic") throw new Error("Expected captured graphic");
    const project = {
      duration: 10,
      aspectRatio: "1:1",
      clips: [],
      transcript: [],
      proposedChanges: [],
    } as unknown as EditProject;
    const next = applyEditOperation(project, {
      id: "insert-saved",
      type: "graphic",
      label: "Insert captured style",
      reason: "Reuse captured editable settings",
      confidence: 1,
      intensity: "balanced",
      status: "proposed",
      start: 1,
      end: 1 + style.graphicDuration,
      targetClipIds: [],
      parameters: { graphic: style.graphic },
    });
    const inserted = next.clips[0];
    expect(inserted.id).not.toBe(clip.id);
    expect(inserted).toMatchObject({
      start: 1,
      inPoint: 0,
      outPoint: 6,
      graphic,
    });
    expect(
      graphicFrame(
        inserted.graphic!,
        3,
        inserted.graphicDuration ?? inserted.outPoint
      )
    ).toEqual(graphicFrame(graphic, 3, 6));
    const ass = graphicAssEvents([inserted], 720, 720, 10);
    expect(ass).toContain("Captured project title");
    expect(ass).toContain("Editable secondary text");
    expect(ass).toContain("\\p1");
    expect(project.clips).toEqual([]);
    expect(clip.inPoint).toBe(4);
  });

  it("captures the actual current pose and grade while dropping source clocks and animation anchors", () => {
    const source: TimelineClip = {
      ...clip,
      id: "private-source",
      assetId: "private-asset",
      track: "video",
      graphic: undefined,
      start: 2,
      duration: 2,
      inPoint: 10,
      outPoint: 14,
      speed: 2,
      visualStart: 10,
      visualDuration: 4,
      brightness: 0.1,
      contrast: 1.2,
      saturation: 0.7,
      fit: "cover",
      visual: normalizeVisual({
        flipX: true,
        crop: { left: 8 },
        mask: "rounded",
        radius: 7,
        keyframes: [
          {
            at: 0,
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            opacity: 1,
            easing: "linear",
          },
          { at: 1, x: 40, y: 0, scale: 2, rotation: 40, opacity: 0.5 },
        ],
      }),
    };
    const style = captureEditorStyle("look", "Current pose", source, {}, 2.5);
    expect(style).toMatchObject({
      type: "look",
      settings: {
        brightness: 0.1,
        contrast: 1.2,
        saturation: 0.7,
        fit: "cover",
        visual: {
          x: 10,
          scale: 1.25,
          rotation: 10,
          opacity: 0.875,
          flipX: true,
          crop: { left: 8 },
          mask: "rounded",
          radius: 7,
          keyframes: [],
          entrance: { kind: "none", duration: 0.5 },
          exit: { kind: "none", duration: 0.5 },
        },
      },
    });
    const json = JSON.stringify(style);
    for (const forbidden of [
      "private-source",
      "private-asset",
      "inPoint",
      "outPoint",
      "visualStart",
      "visualDuration",
      "sourceClipId",
    ])
      expect(json).not.toContain(forbidden);
    expect(() =>
      captureEditorStyle("look", "Outside clip", source, {}, 9)
    ).toThrow("playhead inside");
  });

  it("captures resolved caption colors, animation and layout without transcript or provider fields", () => {
    const project = {
      captionStyle: "pulse",
      captionAppearance: {
        size: 99,
        color: "#123456",
        animation: "word-reveal" as const,
        background: null,
        providerKey: "example-private-provider-field",
        sourceClipId: "private-speech-source",
      },
    };
    const style = captureEditorStyle(
      "captions",
      "My captions",
      undefined,
      project,
      0
    );
    expect(style).toMatchObject({
      type: "captions",
      captionStyle: "pulse",
      captionAppearance: {
        color: "#123456",
        size: 12,
        animation: "word-reveal",
        background: null,
      },
    });
    if (style.type !== "captions") throw new Error("Expected captions");
    expect(
      getCaptionPreset(style.captionStyle, style.captionAppearance)
    ).toEqual(
      getCaptionPreset(project.captionStyle, project.captionAppearance)
    );
    expect(JSON.stringify(style)).not.toContain("private");
    expect(
      normalizeEditorSavedStyle({
        id: "fallback",
        name: "Safe fallback",
        type: "captions",
        captionStyle: "unknown",
      })
    ).toMatchObject({ captionStyle: "classic" });
  });

  it("loads only the allowed schema, preserving graphic motion while stripping private tracking and asset links", () => {
    const raw = {
      id: "safe",
      name: "Safe",
      type: "graphic",
      graphicDuration: 6,
      graphic: {
        ...graphic,
        tracking: { assetId: "private-asset", sourceStart: 40 },
        apiKey: "example-key",
        motion: graphic.motion?.map(key => ({
          ...key,
          sourceClipId: "private-motion-source",
        })),
      },
      assetId: "private-asset",
      url: "https://example.test/private.mp4",
      inPoint: 40,
      credits: 1000,
      provider: "private-provider",
      apiKey: "example-key",
    };
    const style = normalizeEditorSavedStyle(raw);
    expect(style).toEqual({
      id: "safe",
      name: "Safe",
      type: "graphic",
      graphicDuration: 6,
      graphic,
    });
    expect(JSON.stringify(style)).not.toMatch(
      /private|example-key|sourceStart|assetId|credits|apiKey/
    );
  });

  it("enforces IDs, names, animation span and the shared 500-style limit", () => {
    const draft = captureEditorStyle("graphic", "Saved", clip, {}, 0);
    const rows = Array.from({ length: 500 }, (_, i) => ({
      ...draft,
      id: `style-${i}`,
    }));
    expect(() => addEditorSavedStyle(rows, { ...draft, id: "extra" })).toThrow(
      "limit is 500"
    );
    expect(() =>
      addEditorSavedStyle(rows, { ...draft, id: "style-0" })
    ).toThrow("already exists");
    expect(() => addEditorSavedStyle([], { ...draft, id: "bad/id" })).toThrow(
      "valid saved style"
    );
    expect(() =>
      captureEditorStyle("graphic", "x".repeat(61), clip, {}, 0)
    ).toThrow("1 to 60");
    expect(() =>
      captureEditorStyle(
        "graphic",
        "Long",
        { ...clip, graphicDuration: 181 },
        {},
        0
      )
    ).toThrow("1 to 180");
    expect(() =>
      captureEditorStyle("graphic", "Missing", undefined, {}, 0)
    ).toThrow("Select an editable graphic");
    expect(
      normalizeEditorSavedStyles([
        null,
        { ...draft, id: "bad/id" },
        ...rows,
        rows[0],
      ])
    ).toHaveLength(500);
    expect(normalizeEditorSavedStyles([rows[0], rows[0]])).toHaveLength(1);
    expect(
      addEditorSavedStyle(removeEditorSavedStyle(rows, "style-0"), {
        ...draft,
        id: "replacement",
      })
    ).toHaveLength(500);
  });
});
