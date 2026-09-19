import { expect, it } from "vitest";
import { exportSrt, parseSubtitleFile } from "./subtitle-files";

it("imports SRT timings and multiline Unicode and roundtrips editable captions", () => {
  const source =
    "1\r\n00:00:01,250 --> 00:00:03,750\r\nCiao, perché?\r\nA second line 🎬\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,200\r\nDone";
  const imported = parseSubtitleFile(source);
  expect(imported.segments[0]).toMatchObject({
    start: 1.25,
    end: 3.75,
    text: "Ciao, perché?\nA second line 🎬",
  });
  expect(
    parseSubtitleFile(exportSrt(imported.segments)).segments.map(
      ({ id: _, ...s }) => s
    )
  ).toEqual(imported.segments.map(({ id: _, ...s }) => s));
});
it("imports WebVTT with identifiers, cue settings and markup; reports invalid and clipped cues", () => {
  const input =
    "WEBVTT\n\nNOTE author comment\nignored\n\nintro\n00:01.000 --> 00:03.000 align:start\n<v Narrator><b>Welcome</b> &amp; enjoy\n\nbad\n00:61.000 --> 00:62.000\nInvalid minutes\n\nlast\n00:04.000 --> 00:08.000\nEnding";
  const result = parseSubtitleFile(input, 6);
  expect(result).toMatchObject({ skipped: 1, clipped: 1 });
  expect(result.segments[0].text).toBe("Welcome & enjoy");
  expect(result.segments[1]).toMatchObject({ start: 4, end: 6 });
});
it("rejects empty files and avoids exporting reversed or out-of-range cues", () => {
  expect(() => parseSubtitleFile("garbage")).toThrow("No usable captions");
  expect(
    exportSrt(
      [
        { id: "bad", start: 2, end: 1, text: "No" },
        { id: "good", start: 1, end: 4, text: "Yes" },
      ],
      3
    )
  ).toBe("1\n00:00:01,000 --> 00:00:03,000\nYes\n");
});
