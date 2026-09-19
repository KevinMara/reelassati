import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CAPTION_PRESETS,
  GRAPHIC_PRESETS,
  captionLines,
  captionLineWidth,
  getCaptionPreset,
} from "@contracts/editor-presets";
import { normalizeGraphic } from "@contracts/motion-graphics";
import {
  captionAssEvents,
  captionAssStyle,
  captionTextCss,
} from "./caption-rendering";

describe("caption presets", () => {
  it("uses the same size, line breaks, font and colors in preview and export", () => {
    const preset = getCaptionPreset("bold");
    const text = captionLines(
      "Make every second count with clear captions",
      preset
    );
    expect(text.replace(/\n/g, " ")).toBe(
      "MAKE EVERY SECOND COUNT WITH CLEAR CAPTIONS"
    );
    expect(
      text.split("\n").every(line => captionLineWidth(line, preset) <= 76)
    ).toBe(true);
    expect(captionTextCss(preset).fontSize).toBe("5.6cqw");
    expect(captionAssStyle("bold", 1000, 1000)).toContain(
      "Caption,DejaVu Sans,56.00"
    );
    const events = captionAssEvents(
      [{ id: "one", start: 0.25, end: 2.5, text }],
      "bold",
      2
    );
    expect(events).toContain("0:00:00.25,0:00:02.00");
    expect(events).toContain(text.replace(/\n/g, "\\N"));
    expect(getCaptionPreset("unknown").id).toBe("classic");
  });
  it("keeps Unicode intact and removes ASS override commands", () => {
    const p = { ...getCaptionPreset(), maxCharacters: 4 };
    expect(captionLines("🎬🎬🎬🎬🎬", p)).toBe("🎬🎬🎬🎬\n🎬");
    const ass = captionAssEvents(
      [
        { id: "cue", start: -1, end: 1, text: "{\\pos(0,0)}hello" },
        { id: "bad", start: NaN, end: 2, text: "bad" },
      ],
      "classic",
      3
    );
    expect(ass).not.toContain("{\\pos");
    expect(ass).not.toContain("bad");
    expect(ass).toContain("0:00:00.00,0:00:01.00");
    const bold = getCaptionPreset("bold");
    const wide = captionLines("W".repeat(40), bold).split("\n");
    expect(wide.length).toBeGreaterThan(2);
    expect(wide.every(line => captionLineWidth(line, bold) <= 76)).toBe(true);
  });
  it("all offered graphics survive the real render contract without losing settings", () => {
    for (const preset of GRAPHIC_PRESETS)
      expect(normalizeGraphic(preset.graphic)).toEqual(preset.graphic);
    expect(new Set(CAPTION_PRESETS.map(p => p.id)).size).toBe(
      CAPTION_PRESETS.length
    );
    expect(new Set(GRAPHIC_PRESETS.map(p => p.id)).size).toBe(
      GRAPHIC_PRESETS.length
    );
  });
});

let nativeAvailable = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  nativeAvailable = true;
} catch {
  /* Optional on developer machines without FFmpeg. */
}
it.skipIf(!nativeAvailable)(
  "renders top and bottom caption presets in the encoded frame with the selected color",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "reelassati-captions-"));
    try {
      for (const id of ["top-line", "violet-box"] as const) {
        const preset = getCaptionPreset(id);
        const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 720\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n${captionAssStyle(id, 720, 720)}\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${captionAssEvents([{ id: "one", start: 0, end: 1, text: "CAPTIONS" }], id, 1)}\n`;
        writeFileSync(join(dir, "captions.ass"), ass);
        const bytes = execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=720x720:d=1",
            "-vf",
            "subtitles=captions.ass",
            "-frames:v",
            "1",
            "-pix_fmt",
            "rgb24",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { cwd: dir, maxBuffer: 2_000_000 }
        );
        const expected = (preset.background ?? preset.color)
          .slice(1)
          .match(/../g)!
          .map(s => parseInt(s, 16));
        let count = 0,
          ySum = 0;
        for (let i = 0; i < bytes.length; i += 3)
          if (
            expected.every((v, channel) => Math.abs(v - bytes[i + channel]) < 8)
          ) {
            count++;
            ySum += Math.floor(i / 3 / 720);
          }
        expect(count).toBeGreaterThan(100);
        if (id === "top-line") expect(ySum / count).toBeLessThan(150);
        else expect(ySum / count).toBeGreaterThan(550);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);
