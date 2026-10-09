import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCaptionPreset } from "@contracts/editor-presets";
import { captionMotion, captionRuns } from "@contracts/caption-runs";
import { captionAssEvents, captionAssStyle } from "./caption-rendering";
const cue = {
  id: "cue",
  start: 0,
  end: 1,
  text: "FIRST SECOND",
  words: [
    { text: "FIRST", start: 0.2, end: 0.6 },
    { text: "SECOND", start: 0.8, end: 1 },
  ],
};
const modes = ["word-pop", "word-slide", "word-fade", "word-type"] as const;
function ass(mode: (typeof modes)[number], fps = 30) {
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 360\nPlayResY: 360\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n${captionAssStyle(mode, 360, 360)}\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${captionAssEvents([cue], mode, 1, undefined, { width: 360, height: 360, frameRate: fps })}\n`;
}
function stats(bytes: Uint8Array, frame: number) {
  let count = 0,
    sumY = 0,
    minX = 360,
    maxX = 0;
  const from = frame * 360 * 360 * 3;
  for (let y = 0; y < 360; y++)
    for (let x = 0; x < 360; x++) {
      const at = from + (y * 360 + x) * 3;
      if (bytes[at] > 40 && bytes[at + 1] > 40) {
        count++;
        sumY += y;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  return {
    count,
    y: count ? sumY / count : 0,
    width: count ? maxX - minX + 1 : 0,
  };
}
describe("measured word motion preview and actual ASS output", () => {
  for (const mode of modes)
    it(`${mode} uses one actual word, preserves pauses, and falls back without measured clocks`, () => {
      const p = getCaptionPreset(mode);
      expect(captionRuns(cue, p, 0.7)).toEqual([]);
      expect(
        captionRuns({ ...cue, words: undefined }, p, 0.3)
          .map(r => r.text)
          .join("")
      ).toBe("FIRST SECOND");
      expect(captionMotion({ ...cue, words: undefined }, p, 0.3)).toEqual({
        scale: 1,
        y: 0,
        opacity: 1,
      });
      expect(
        captionRuns(cue, p, 0.5)
          .map(r => r.text)
          .join("")
      ).toBe("FIRST");
      expect(ass(mode, 60)).not.toContain("NaN");
    });
  it("types complete Unicode graphemes instead of splitting combining marks", () => {
    const unicode = {
      ...cue,
      text: "가 나",
      words: [
        { text: "가", start: 0.2, end: 0.6 },
        { text: "나", start: 0.8, end: 1 },
      ],
    };
    expect(captionRuns(unicode, getCaptionPreset("word-type"), 0.21)).toEqual([
      { text: "가", active: true },
    ]);
  });
  for (const mode of modes)
    it(`renders real ${mode} entrance pixels and no text during speech gaps`, () => {
      const dir = mkdtempSync(join(tmpdir(), "reel-word-motion-"));
      try {
        writeFileSync(join(dir, "captions.ass"), ass(mode));
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
            "color=black:s=360x360:r=30:d=1",
            "-vf",
            "subtitles=captions.ass,format=rgb24",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { cwd: dir, maxBuffer: 15_000_000, timeout: 15000 }
        );
        const early = stats(bytes, 6),
          late = stats(bytes, 15);
        expect(late.count).toBeGreaterThan(50);
        expect(stats(bytes, 21).count).toBe(0);
        expect(stats(bytes, 0).count).toBe(0);
        if (mode === "word-pop" || mode === "word-type")
          expect(early.width).toBeLessThan(late.width);
        if (mode === "word-fade")
          expect(early.count).toBeLessThan(late.count / 2);
        if (mode === "word-slide")
          expect(stats(bytes, 7).y).toBeGreaterThan(late.y);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
});
