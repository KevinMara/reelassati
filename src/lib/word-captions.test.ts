import { describe, it, expect } from "vitest";
import {
  normalizeTranscriptWords,
  providerTranscriptSegments,
  mapTranscriptTime,
} from "@contracts/transcript-timing";
import { captionRuns } from "@contracts/caption-runs";
import { getCaptionPreset } from "@contracts/editor-presets";
import { captionAssEvents, captionAssStyle } from "./caption-rendering";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const cue = {
  id: "cue",
  text: "FIRST SECOND",
  start: 0,
  end: 2,
  words: [
    { text: "FIRST", start: 0, end: 0.4 },
    { text: "SECOND", start: 1, end: 1.4 },
  ],
};
describe("measured word captions", () => {
  it("preserves actual provider clocks and chunk offsets without inventing missing timing", () => {
    const result = providerTranscriptSegments(
      {
        segments: [{ text: cue.text, start: 0, end: 2, words: [] }],
        words: cue.words.map(w => ({
          word: w.text,
          start: w.start,
          end: w.end,
        })),
      },
      2,
      7
    );
    expect(result[0].words).toEqual(
      cue.words.map(w => ({ ...w, start: w.start + 7, end: w.end + 7 }))
    );
    expect(
      providerTranscriptSegments({ text: "No clock" }, 2)[0].words
    ).toBeUndefined();
    expect(
      providerTranscriptSegments(
        { segments: "malformed" as never, text: "Fallback" },
        2
      )[0].text
    ).toBe("Fallback");
    expect(
      providerTranscriptSegments(
        {
          segments: [
            {
              ...cue,
              words: [{ text: "FIRST", start: -1, end: 0.4 }, cue.words[1]],
            },
          ],
        },
        2
      )[0].words
    ).toBeUndefined();
  });
  it("invalidates changed lexical content, including merged words and decimal values", () => {
    expect(
      normalizeTranscriptWords("icecream", [
        { text: "ice", start: 0, end: 1 },
        { text: "cream", start: 1, end: 2 },
      ])
    ).toBeUndefined();
    expect(
      normalizeTranscriptWords("15", [{ text: "1.5", start: 0, end: 1 }])
    ).toBeUndefined();
    expect(normalizeTranscriptWords("First, second!", cue.words)).toEqual(
      cue.words
    );
  });
  it("retimes measured words with source speed and removes words cut from audible footage", () => {
    const mapped = mapTranscriptTime(cue, t => 5 + (t - 0.6) / 2, {
      start: 5,
      end: 5.7,
    });
    expect(mapped.text).toBe("SECOND");
    expect(mapped.words).toEqual([{ text: "SECOND", start: 5.2, end: 5.4 }]);
    expect(
      captionRuns(
        { ...cue, start: 0.2, end: 3 },
        getCaptionPreset("kinetic"),
        1.2
      )
        .filter(r => r.active)
        .map(r => r.text)
        .join("")
    ).toBe("SECOND");
  });
  it("keeps speech gaps static and highlights complete grapheme clusters", () => {
    const p = getCaptionPreset("kinetic");
    expect(captionRuns(cue, p, 0.2).find(r => r.active)?.text).toBe("FIRST");
    expect(captionRuns(cue, p, 0.7).some(r => r.active)).toBe(false);
    expect(
      captionRuns({ ...cue, words: undefined }, p, 0.2).some(r => r.active)
    ).toBe(false);
    const korean = {
      ...cue,
      text: "가 나",
      words: [
        { text: "가", start: 0, end: 0.4 },
        { text: "나", start: 1, end: 1.4 },
      ],
    };
    expect(captionRuns(korean, p, 0.2).find(r => r.active)?.text).toBe("가");
    const events = captionAssEvents(
      [
        {
          ...cue,
          words: [{ text: "FIRST", start: 0.001, end: 0.004 }, cue.words[1]],
        },
      ],
      "kinetic",
      2
    );
    expect(events).not.toContain("0:00:00.00,0:00:00.00");
  });
  it("burns matching active-word colors into exported frames, with no highlight in speech gaps", () => {
    const dir = mkdtempSync(join(tmpdir(), "reel-words-"));
    try {
      const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 360\nPlayResY: 360\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n${captionAssStyle("kinetic", 360, 360)}\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${captionAssEvents([cue], "kinetic", 2)}\n`;
      writeFileSync(join(dir, "words.ass"), header);
      const frames = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=black:s=360x360:d=2:r=10",
          "-vf",
          "subtitles=words.ass,select='eq(n,2)+eq(n,7)+eq(n,12)'",
          "-vsync",
          "0",
          "-frames:v",
          "3",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { cwd: dir, maxBuffer: 2000000 }
      );
      const highlight = (frame: number) => {
        let count = 0,
          sum = 0;
        for (
          let i = frame * 360 * 360 * 3;
          i < (frame + 1) * 360 * 360 * 3;
          i += 3
        ) {
          if (frames[i] > 180 && frames[i + 1] > 150 && frames[i + 2] < 130) {
            count++;
            sum += Math.floor(i / 3) % 360;
          }
        }
        return { count, x: sum / count };
      };
      expect(highlight(0).count).toBeGreaterThan(50);
      expect(highlight(1).count).toBe(0);
      expect(highlight(2).count).toBeGreaterThan(50);
      expect(highlight(0).x).toBeLessThan(highlight(2).x);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
