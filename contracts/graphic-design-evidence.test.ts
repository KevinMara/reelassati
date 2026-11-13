import { describe, expect, it } from "vitest";
import {
  editorPresetCatalog,
  resolveEditorPresetOperation,
} from "./editor-preset-catalog";
import { graphicDesignEvidence } from "./graphic-design-evidence";
import { graphicFrame, normalizeGraphic } from "./motion-graphics";
import { MOTION_KITS, motionKitClips } from "./motion-kits";
import { GRAPHIC_PRESETS } from "./editor-presets";
import type { MotionGraphic } from "./motion-graphics";
import type { EditorSavedStyle } from "./editor-style-library";

function resolve(
  presetId: string,
  parameters: Record<string, unknown> = {},
  styles: EditorSavedStyle[] = []
) {
  return (
    resolveEditorPresetOperation(
      {
        type: "graphic",
        start: 8,
        end: 12,
        parameters: { presetId, ...parameters },
      },
      styles
    ) as { parameters: { graphic: MotionGraphic } }
  ).parameters.graphic;
}

describe("source-independent preset design", () => {
  it("selects the same statistic accent with and without the optional context", () => {
    const parameters = {
      kitTitle: "Survey result",
      kitValue: 72,
      kitAccent: "#123456",
    };
    const withContext = resolve("motion:statistic:2", {
      ...parameters,
      kitSubtitle: "Actual context",
    });
    const withoutContext = resolve("motion:statistic:2", parameters);
    expect(withoutContext).toEqual(withContext);
    expect(withoutContext.kind).toBe("line");
    expect(() => resolve("motion:statistic:1", parameters)).toThrow(
      /optional content/
    );
    expect(
      resolve("motion:statistic:1", {
        ...parameters,
        kitSubtitle: "Actual context",
      }).text
    ).toBe("Actual context");
    expect(graphicFrame(withoutContext, 2, 4)).toMatchObject({
      opacity: 1,
      y: 20,
    });
  });

  it("resolves every available slot when optional copy is absent, without demo text", () => {
    for (const kit of MOTION_KITS) {
      const expected = motionKitClips(
        {
          kit: kit.id,
          title: "Current source",
          subtitle: "",
          accent: "#123456",
          seconds: 4,
          value: 72,
        },
        [],
        0,
        "manual"
      );
      for (const layer of expected) {
        const slot = layer.id.slice("manual-".length);
        const actual = resolve(`motion:${kit.id}:${slot}`, {
          kitTitle: "Current source",
          kitValue: 72,
          kitAccent: "#123456",
        });
        expect(actual).toEqual(layer.graphic);
        expect(JSON.stringify(actual)).not.toContain(kit.subtitle);
      }
    }
    expect(() => resolve("motion:speaker:0")).toThrow(/title/);
    expect(() => resolve("motion:statistic:0", { kitTitle: "Result" })).toThrow(
      /measured/
    );
  });

  it("does not insert a demo name, old attribution or a saved measurement", () => {
    expect(() => resolve("nameplate")).toThrow(/actual text/);
    const name = resolve("nameplate", { graphic: { text: "Actual speaker" } });
    expect(name.text).toBe("Actual speaker");
    expect(name.secondaryText).toBe("");
    expect(JSON.stringify(name)).not.toContain("Creative director");
    expect(() => resolve("stat-proof")).toThrow(/measured/);
    const counter = resolve("stat-proof", {
      graphic: {
        from: 0,
        to: 72,
        suffix: "%",
        secondaryText: "Measured result",
      },
    });
    expect(graphicFrame(counter, 3, 4).text).toBe("72%");
    const saved: EditorSavedStyle = {
      id: "previous-result",
      name: "My result design",
      type: "graphic",
      graphicDuration: 4,
      graphic: normalizeGraphic({
        kind: "counter",
        from: 837,
        to: 943,
        prefix: "Old claim",
        suffix: "old unit",
        secondaryText: "Previous client",
      })!,
    };
    expect(() => resolve(saved.id, {}, [saved])).toThrow(/measured/);
    const reused = resolve(saved.id, { graphic: { from: 0, to: 72 } }, [saved]);
    expect(reused).toMatchObject({
      from: 0,
      to: 72,
      prefix: "",
      suffix: "",
      secondaryText: "",
    });
    const evidence = JSON.stringify(editorPresetCatalog([saved]));
    for (const sourceText of [
      "Old claim",
      "old unit",
      "Previous client",
      "837",
      "943",
    ])
      expect(evidence).not.toContain(sourceText);
  });

  it("exposes actual appearance and bounded renderer-derived motion without source copy", () => {
    const graphic = normalizeGraphic({
      kind: "callout",
      text: "Private source heading",
      secondaryText: "Private source detail",
      x: 35,
      y: 62,
      size: 4.2,
      color: "#112233",
      background: "#445566",
      accent: "#778899",
      width: 30,
      padding: 2,
      motion: Array.from({ length: 120 }, (_, i) => ({
        at: i / 119,
        x: 20 + i / 4,
        y: 62,
        scale: 1,
        rotation: 0,
        opacity: i === 0 ? 0 : 1,
        easing: "ease-out",
      })),
    })!;
    const evidence = graphicDesignEvidence(graphic, 4);
    expect(evidence).toMatchObject({
      layout: { x: 35, y: 62, width: 30 },
      palette: { color: "#112233" },
      motion: { keyframeCount: 120, easing: ["ease-out"] },
    });
    expect(evidence.motion!.poses).toHaveLength(5);
    for (const [progress, x, y, scale, rotation, opacity] of evidence.motion!
      .poses) {
      const actual = graphicFrame(graphic, progress * (4 - 1 / 30), 4, false);
      expect(x).toBeCloseTo(actual.x, 3);
      expect(y).toBeCloseTo(actual.y, 3);
      expect(scale).toBeCloseTo(actual.scale, 3);
      expect(rotation).toBeCloseTo(actual.rotation, 3);
      expect(opacity).toBeCloseTo(actual.opacity, 3);
    }
    expect(JSON.stringify(evidence)).not.toContain("Private source");
    const saved: EditorSavedStyle = {
      id: "custom-motion",
      name: "Custom motion",
      type: "graphic",
      graphic,
      graphicDuration: 4,
    };
    const applied = resolve(saved.id, { graphic: { text: "Current source" } }, [
      saved,
    ]);
    expect(applied.motion).toEqual(graphic.motion);
    expect(applied.motion).toHaveLength(120);
  });

  it("exposes distinct design evidence for same-named personal styles and motion variants", () => {
    const base = GRAPHIC_PRESETS.find(p => p.graphic.motion?.length)!;
    const styles: EditorSavedStyle[] = [25, 75].map((y, i) => ({
      id: `same-name-${i}`,
      name: "Title",
      type: "graphic",
      graphicDuration: 4,
      graphic: { ...base.graphic, y },
    }));
    const catalog = editorPresetCatalog(styles);
    expect(catalog.personal[0]).not.toEqual({
      ...catalog.personal[1],
      id: styles[0].id,
    });
    expect(
      catalog.graphics.find(p => p.id === base.id)?.design.motion
    ).toBeDefined();
    expect(catalog.looks[0]).toHaveProperty("settings");
    expect(catalog.captions[0]).toHaveProperty("animation");
    expect(catalog.captions[0]).toHaveProperty("size");
  });
});
