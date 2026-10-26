import { describe, expect, it } from "vitest";
import {
  graphicReadabilityProblems,
  solidColorContrast,
} from "./graphic-readability";
import { normalizeGraphic } from "./motion-graphics";
import type { TimelineClip } from "./workspace";

const clip = {
  id: "card",
  label: "Score",
  start: 0,
  duration: 3,
  inPoint: 0,
  outPoint: 3,
  graphic: normalizeGraphic({
    kind: "callout",
    text: "30 domande",
    secondaryText: "Un esempio",
    x: 50,
    y: 20,
    size: 6,
    color: "#FFFFFF",
    background: "#172033",
    accent: "#F2C14E",
  }),
} as TimelineClip;

describe("deterministic generated graphic checks", () => {
  it("checks actual primary and secondary colors against a filled card", () => {
    expect(solidColorContrast("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(solidColorContrast("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(graphicReadabilityProblems(clip)).toEqual([]);
    expect(
      graphicReadabilityProblems({
        ...clip,
        graphic: { ...clip.graphic!, background: "#FFFFFF" },
      })
    ).toEqual([
      "Graphic text lacks contrast against its card: Score",
      "Graphic secondary text lacks contrast against its card: Score",
    ]);
  });
  it("does not mistake the unused background on transparent text for a real contrast measurement", () => {
    expect(
      graphicReadabilityProblems({
        ...clip,
        graphic: {
          ...clip.graphic!,
          kind: "text",
          color: "#FFFFFF",
          background: "#FFFFFF",
          accent: "#FFFFFF",
        },
      })
    ).toEqual([]);
  });
  it("uses the actual wrapped card bounds and output aspect ratio rather than its anchor", () => {
    expect(
      graphicReadabilityProblems({
        ...clip,
        graphic: { ...clip.graphic!, x: 90 },
      })
    ).toContain("Graphic text never fits fully inside the frame: Score");
    const top = {
      ...clip,
      graphic: {
        ...clip.graphic!,
        y: 10,
        size: 8,
        text: "Una spiegazione con tante parole",
        secondaryText: "Ancora una riga",
      },
    };
    expect(graphicReadabilityProblems(top, "16:9")).toContain(
      "Graphic text never fits fully inside the frame: Score"
    );
  });
  it("permits an offscreen entrance with a readable hold and rejects a text flash", () => {
    const moving = {
      ...clip,
      graphic: {
        ...clip.graphic!,
        animation: "none" as const,
        motion: [
          { at: 0, x: 0, y: 20, scale: 1, rotation: 0, opacity: 0 },
          {
            at: 0.2,
            x: 50,
            y: 20,
            scale: 1,
            rotation: 0,
            opacity: 1,
            easing: "hold" as const,
          },
          { at: 1, x: 50, y: 20, scale: 1, rotation: 0, opacity: 1 },
        ],
      },
    };
    expect(graphicReadabilityProblems(moving)).toEqual([]);
    expect(
      graphicReadabilityProblems({ ...clip, duration: 0.3, outPoint: 0.3 })
    ).toContain("Graphic text has too little visible reading time: Score");
  });
  it("does not apply text reading rules to purposeful shapes or hidden graphics", () => {
    expect(
      graphicReadabilityProblems({
        ...clip,
        graphic: { ...clip.graphic!, kind: "arrow" },
        duration: 0.1,
      })
    ).toEqual([]);
    expect(
      graphicReadabilityProblems({ ...clip, hidden: true, duration: 0.1 })
    ).toEqual([]);
  });
});
