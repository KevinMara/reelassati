import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captionMotionFrame } from "@contracts/caption-motion";
import {
  CAPTION_MOTION_RECIPES,
  getCaptionPreset,
  normalizeCaptionMotion,
  type CaptionMotionSettings,
} from "@contracts/editor-presets";
import {
  captureEditorStyle,
  normalizeEditorSavedStyle,
} from "@contracts/editor-style-library";
import {
  captureEditStyle,
  normalizeEditStyleProfile,
} from "@contracts/edit-style-template";
import type { EditProject } from "@contracts/workspace";
import { captionAssEvents, captionAssStyle } from "./caption-rendering";

const cue = {
  id: "cue",
  start: 0,
  end: 2,
  text: "FIRST SECOND",
  words: [
    { text: "FIRST", start: 0.2, end: 0.8 },
    { text: "SECOND", start: 1, end: 1.6 },
  ],
};
const p = (motion: Partial<CaptionMotionSettings>) =>
  getCaptionPreset("motion-rise", { motion });
const frame = (motion: Partial<CaptionMotionSettings>, time: number) =>
  captionMotionFrame(cue, p(motion), time)!;

describe("editable caption compositions", () => {
  it("uses complete measured clocks, keeps source words immutable and settles every recipe", () => {
    const original = structuredClone(cue);
    for (const recipe of CAPTION_MOTION_RECIPES)
      for (const unit of ["letter", "word", "line"] as const) {
        const settings = { recipe, unit, blur: 0.8, glow: 0.4, amount: 1.2 };
        const before = frame(settings, 0);
        expect(before.units.every(u => u.opacity === 0)).toBe(true);
        const settled = frame(settings, 1.9);
        expect(
          settled.units.every(
            u => u.opacity === 1 && u.scale === 1 && u.blur === 0
          )
        ).toBe(true);
        expect(
          settled.units
            .map(u => u.text)
            .join("")
            .replaceAll(" ", "")
        ).toBe("FIRSTSECOND");
        expect(captionMotionFrame(cue, p(settings), 0.245)).toEqual(
          captionMotionFrame(cue, p(settings), 0.24)
        );
      }
    expect(cue).toEqual(original);
    expect(
      captionMotionFrame({ ...cue, words: undefined }, p({}), 0.5)
    ).toBeUndefined();
    expect(
      captionMotionFrame({ ...cue, text: "Changed words" }, p({}), 0.5)
    ).toBeUndefined();
    const centered = {
      motion: { verticalAnchor: "center" as const, anchor: "right" as const },
    };
    expect(
      captionAssStyle("motion-rise", 360, 360, centered).split(",")[18]
    ).toBe("6");
    expect(
      captionAssEvents(
        [{ ...cue, words: undefined }],
        "motion-rise",
        2,
        centered,
        { width: 360, height: 360 }
      )
    ).toContain("FIRST SECOND");
  });

  it("keeps full Unicode graphemes and staggers letters without moving measured word starts", () => {
    const unicode = {
      ...cue,
      text: "가 é",
      words: [
        { text: "가", start: 0.2, end: 0.8 },
        { text: "é", start: 1, end: 1.6 },
      ],
    };
    expect(
      captionMotionFrame(unicode, p({ unit: "letter" }), 1.9)!.units.map(
        u => u.text
      )
    ).toEqual(["가", "é"]);
    const first = frame({ unit: "letter", stagger: 0.12 }, 0.2334).units.slice(
      0,
      5
    );
    expect(first[0].opacity).toBeGreaterThan(first[1].opacity);
    expect(first.at(-1)!.opacity).toBe(0);
    expect(
      frame({ unit: "word" }, 0.9).units.find(u => u.text.includes("SECOND"))!
        .opacity
    ).toBe(0);
  });

  it("gives direction, amount, duration, easing and anchors independent visible effects", () => {
    expect(frame({ direction: "up" }, 0.3).units[0].y).toBeGreaterThan(
      frame({ direction: "down" }, 0.3).units[0].y
    );
    expect(frame({ direction: "left" }, 0.3).units[0].x).toBeGreaterThan(
      frame({ direction: "right" }, 0.3).units[0].x
    );
    expect(frame({ amount: 2 }, 0.3).units[0].y).toBeGreaterThan(
      frame({ amount: 0.2 }, 0.3).units[0].y
    );
    expect(frame({ duration: 0.38 }, 0.3).units[0].y).toBeGreaterThan(
      frame({ duration: 0.1 }, 0.3).units[0].y
    );
    expect(frame({ easing: "linear" }, 0.3).units[0].y).toBeGreaterThan(
      frame({ easing: "snappy" }, 0.3).units[0].y
    );
    expect(frame({ anchor: "left" }, 1.9).units[0].x).toBe(0);
    expect(frame({ verticalAnchor: "center" }, 1.9).verticalAnchor).toBe(
      "center"
    );
    expect(
      frame({ anchor: "right" }, 1.9).units.at(-1)!.x +
        frame({ anchor: "right" }, 1.9).units.at(-1)!.width
    ).toBeCloseTo(0);
  });

  it("keeps RTL words in reading order and preserves connected Arabic letter shapes", () => {
    const arabic = {
      ...cue,
      text: "مرحبا بكم",
      words: [
        { text: "مرحبا", start: 0.2, end: 0.8 },
        { text: "بكم", start: 1, end: 1.6 },
      ],
    };
    const units = captionMotionFrame(arabic, p({ unit: "letter" }), 1.9)!.units;
    expect(units.map(u => u.text.trim())).toEqual(["مرحبا", "بكم"]);
    expect(units[0].x).toBeGreaterThan(units[1].x);
    expect(units.every(u => u.direction === "rtl")).toBe(true);
  });

  it("starts partial recipe changes from their defaults while preserving explicit custom values", () => {
    expect(
      getCaptionPreset("motion-rise", { motion: { recipe: "focus" } }).motion
    ).toEqual(normalizeCaptionMotion({ recipe: "focus" }));
    const appearance = {
      motion: {
        recipe: "focus" as const,
        unit: "letter" as const,
        blur: 0,
        duration: 0.7,
        anchor: "right" as const,
      },
    };
    const changed = getCaptionPreset("motion-rise", appearance).motion;
    expect(changed).toMatchObject(appearance.motion);
    expect(
      getCaptionPreset("motion-focus", { motion: { amount: 0.8 } }).motion
    ).toMatchObject({
      recipe: "focus",
      unit: "line",
      blur: 0.45,
      duration: 0.42,
      amount: 0.8,
    });
    const saved = normalizeEditorSavedStyle({
      id: "partial-recipe",
      ...captureEditorStyle(
        "captions",
        "Custom focus",
        undefined,
        { captionStyle: "motion-rise", captionAppearance: appearance },
        0
      ),
    });
    expect(saved).toMatchObject({ captionAppearance: { motion: changed } });
    if (saved?.type !== "captions") throw new Error("Expected saved captions");
    expect(
      getCaptionPreset(saved.captionStyle, saved.captionAppearance).motion
    ).toEqual(changed);
  });

  it("retains custom motion across saved styles and reusable edit templates while clamping unsafe imports", () => {
    const motion = normalizeCaptionMotion({
      recipe: "focus",
      unit: "letter",
      direction: "right",
      duration: 0.42,
      stagger: 0.035,
      anchor: "right",
      blur: 0.6,
      glow: 0.2,
    });
    const project = {
      captionStyle: "motion-focus",
      captionAppearance: { motion },
      transcript: [cue],
      clips: [
        {
          id: "source",
          assetId: "footage",
          track: "video",
          start: 0,
          duration: 2,
          inPoint: 0,
          outPoint: 2,
        },
      ],
      duration: 2,
    } as unknown as EditProject;
    const saved = normalizeEditorSavedStyle({
      id: "saved",
      ...captureEditorStyle("captions", "Focus", undefined, project, 0),
    });
    expect(saved).toMatchObject({ captionAppearance: { motion } });
    expect(normalizeEditStyleProfile(captureEditStyle(project))).toMatchObject({
      captionTreatment: { appearance: { motion } },
    });
    expect(
      normalizeCaptionMotion({
        duration: Infinity,
        amount: 500,
        delay: -5,
        blur: 20,
      })
    ).toMatchObject({ duration: 0.32, amount: 2, delay: 0, blur: 1.2 });
    expect(normalizeCaptionMotion({ recipe: "focus" })).toMatchObject({
      unit: "line",
      blur: 0.45,
    });
    expect(normalizeCaptionMotion({ recipe: "sweep" })).toMatchObject({
      unit: "letter",
      glow: 0.35,
    });
  });

  for (const recipe of ["rise", "focus", "bounce", "sweep"] as const)
    it(`renders actual ${recipe} pixels with a clear final phrase`, () => {
      const dir = mkdtempSync(join(tmpdir(), "reel-caption-composition-"));
      const appearance = {
        motion: {
          recipe,
          unit: "letter" as const,
          blur: recipe === "focus" ? 0.8 : 0,
          glow: recipe === "sweep" ? 0.4 : 0,
          verticalAnchor:
            recipe === "focus" ? ("center" as const) : ("auto" as const),
        },
      };
      try {
        const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 360\nPlayResY: 360\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n${captionAssStyle("motion-rise", 360, 360, appearance)}\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${captionAssEvents([cue], "motion-rise", 2, appearance, { width: 360, height: 360, frameRate: 30 })}\n`;
        expect(ass).not.toContain("NaN");
        if (recipe === "focus") expect(ass).toMatch(/\\pos\([\d.-]+,180\.00\)/);
        writeFileSync(join(dir, "captions.ass"), ass);
        copyFileSync(
          "public/fonts/DejaVuSans.ttf",
          join(dir, "DejaVuSans.ttf")
        );
        const bytes = execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-filter_threads",
            "1",
            "-f",
            "lavfi",
            "-i",
            "color=black:s=360x360:r=30:d=2",
            "-vf",
            "subtitles=captions.ass:fontsdir=.,format=rgb24",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { cwd: dir, maxBuffer: 30_000_000, timeout: 15000 }
        );
        const pixels = (n: number) => {
          let count = 0;
          for (let i = n * 360 * 360 * 3; i < (n + 1) * 360 * 360 * 3; i += 3)
            if (bytes[i] > 40 && bytes[i + 1] > 40) count++;
          return count;
        };
        expect(pixels(0)).toBe(0);
        expect(pixels(56)).toBeGreaterThan(400);
        expect(pixels(7)).toBeLessThan(pixels(56));
        expect(pixels(50)).toBe(pixels(56));
        if (recipe === "focus") {
          let sumY = 0,
            count = 0;
          for (let y = 0; y < 360; y++)
            for (let x = 0; x < 360; x++) {
              const at = (56 * 360 * 360 + y * 360 + x) * 3;
              if (bytes[at] > 40 && bytes[at + 1] > 40) {
                sumY += y;
                count++;
              }
            }
          expect(sumY / count).toBeGreaterThan(174);
          expect(sumY / count).toBeLessThan(186);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
});
