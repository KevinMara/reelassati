import { describe, expect, it } from "vitest";
import { parseLocalTranscriptSegments } from "./local-transcript";

const segment = () => ({
  id: "speech",
  text: " Ciao! ",
  start: 0.12,
  end: 0.16,
  words: [{ text: " Ciao! ", start: 0.12, end: 0.16 }],
});

describe("strict local transcript registration", () => {
  it("preserves sub-100ms measured timing and all supplied text exactly", () => {
    const input = [segment()];
    expect(parseLocalTranscriptSegments(input, 2)).toEqual(input);
    expect(parseLocalTranscriptSegments([], 2)).toEqual([]);
  });
  it.each([
    undefined,
    {},
    [null],
    [{ ...segment(), words: undefined }],
    [{ ...segment(), words: [] }],
  ])(
    "rejects malformed input instead of silently returning empty speech",
    input => {
      expect(() => parseLocalTranscriptSegments(input, 2)).toThrow();
    }
  );
  it.each([NaN, Infinity, -Infinity, -1, "0"])(
    "rejects an invalid segment start (%s)",
    start => {
      expect(() =>
        parseLocalTranscriptSegments([{ ...segment(), start }], 2)
      ).toThrow();
    }
  );
  it("rejects out-of-source, inverted, and over-ten-minute boundaries", () => {
    expect(() => parseLocalTranscriptSegments([segment()], 0.15)).toThrow();
    expect(() =>
      parseLocalTranscriptSegments([{ ...segment(), end: 0.12 }], 2)
    ).toThrow();
    expect(() =>
      parseLocalTranscriptSegments([{ ...segment(), end: 600.01 }], 700)
    ).toThrow();
  });
  it.each([
    null,
    { text: "Ciao!", start: 0.1, end: 0.16 },
    { text: "Ciao!", start: 0.12, end: Infinity },
    { text: "Ciao!", start: 0.12, end: 0.17 },
    { text: "Ciao!", start: 0.12, end: 0.12 },
  ])("rejects malformed words without dropping or repairing them", word => {
    expect(() =>
      parseLocalTranscriptSegments([{ ...segment(), words: [word] }], 2)
    ).toThrow();
  });
  it("requires timed words to cover the complete text", () => {
    expect(() =>
      parseLocalTranscriptSegments(
        [{ ...segment(), text: "Ciao! Missing word" }],
        2
      )
    ).toThrow();
  });
  it("rejects unordered segments, unordered words, and duplicate identifiers", () => {
    const first = segment();
    const second = {
      id: "later",
      text: "after",
      start: 1,
      end: 1.3,
      words: [{ text: "after", start: 1, end: 1.3 }],
    };
    expect(() => parseLocalTranscriptSegments([second, first], 2)).toThrow();
    expect(() =>
      parseLocalTranscriptSegments([first, { ...second, id: first.id }], 2)
    ).toThrow();
    expect(() =>
      parseLocalTranscriptSegments(
        [
          {
            ...first,
            text: "a b",
            end: 1,
            words: [
              { text: "a", start: 0.5, end: 0.8 },
              { text: "b", start: 0.2, end: 0.4 },
            ],
          },
        ],
        2
      )
    ).toThrow();
  });
  it("rejects excessive segment counts and an invalid source duration", () => {
    expect(() =>
      parseLocalTranscriptSegments(Array.from({ length: 5001 }, segment), 2)
    ).toThrow();
    expect(() => parseLocalTranscriptSegments([], NaN)).toThrow();
    expect(() => parseLocalTranscriptSegments([], 0)).toThrow();
  });
});
