import { describe, expect, it } from "vitest";
import { normalizeScriptWritingPack } from "./script-writing-pack";

function pack() {
  return {
    version: 1,
    clock: "planned",
    scriptText: "Try this. Watch the demonstration. Save the steps.",
    hooks: Array.from({ length: 10 }, (_, index) => ({
      rank: 10 - index,
      spoken: `Try approach ${index + 1}`,
      screenText: `Approach ${index + 1}`,
      reason: "The opening introduces the demonstration clearly.",
    })),
    beats: [
      {
        start: 0,
        end: 3,
        spoken: "Try this.",
        screenText: "Try this",
        visual: "Show the original object.",
      },
      {
        start: 3,
        end: 25,
        spoken: "Watch the demonstration.",
        screenText: "The steps",
        visual: "Show each step in order.",
      },
      {
        start: 25,
        end: 30,
        spoken: "Save the steps.",
        screenText: "Save for later",
        visual: "Show the completed object.",
      },
    ],
    alternateCtas: ["Save the steps for later.", "Try the steps yourself."],
  };
}

describe("bounded planned script writing pack", () => {
  it("sorts creative ranks and preserves separate planned narration, text and visuals", () => {
    const value = pack();
    const normalized = normalizeScriptWritingPack(value, 30)!;
    expect(normalized.hooks.map(hook => hook.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(normalized.beats).toEqual(value.beats);
    expect(normalized.scriptText).toBe(value.scriptText);
    expect(normalized.clock).toBe("planned");
    expect(normalized.alternateCtas).toEqual(value.alternateCtas);
  });
  it("binds original narration from the server and ignores provider scoring or unknown keys", () => {
    const value = pack();
    const raw = {
      ...value,
      scriptText: "Forged provider baseline",
      viralityScore: 99,
      hooks: value.hooks.map(hook => ({
        ...hook,
        score: 99,
        tracking: "unsupported",
      })),
    };
    const normalized = normalizeScriptWritingPack(raw, 30, value.scriptText)!;
    expect(normalized.scriptText).toBe(value.scriptText);
    expect(JSON.stringify(normalized)).not.toMatch(/score|Score|tracking/);
  });
  it("supports Unicode wording and trims bounded text without inventing missing fields", () => {
    const value = pack();
    value.hooks[0].spoken = "  Guarda questo passaggio ✨  ";
    expect(normalizeScriptWritingPack(value, 30)?.hooks.at(-1)?.spoken).toBe(
      "Guarda questo passaggio ✨"
    );
  });
  it.each([0, -1, NaN, Infinity, 181])(
    "omits a pack for invalid requested duration %s",
    duration => {
      expect(normalizeScriptWritingPack(pack(), duration)).toBeUndefined();
    }
  );
  it.each([
    [4, 3],
    [3, 3],
    [-1, 3],
    [NaN, 3],
    [0, Infinity],
    ["0", 3],
    [1, 3],
    [0, 31],
  ])(
    "rejects invalid planned interval %s to %s without clamping",
    (start, end) => {
      const value = pack();
      Object.assign(value.beats[0], { start, end });
      expect(normalizeScriptWritingPack(value, 30)).toBeUndefined();
    }
  );
  it("rejects gaps, overlaps, reversed order and incomplete target coverage", () => {
    for (const mutation of [
      (value: ReturnType<typeof pack>) => {
        value.beats[1].start = 4;
      },
      (value: ReturnType<typeof pack>) => {
        value.beats[1].start = 2;
      },
      (value: ReturnType<typeof pack>) => {
        value.beats.reverse();
      },
      (value: ReturnType<typeof pack>) => {
        value.beats[2].end = 29.9;
      },
    ]) {
      const value = pack();
      mutation(value);
      expect(normalizeScriptWritingPack(value, 30)).toBeUndefined();
    }
  });
  it("requires exactly ten distinct ranked openings and two distinct CTA alternatives", () => {
    for (const mutation of [
      (value: ReturnType<typeof pack>) => {
        value.hooks.pop();
      },
      (value: ReturnType<typeof pack>) => {
        value.hooks[0].rank = value.hooks[1].rank;
      },
      (value: ReturnType<typeof pack>) => {
        value.hooks[0].rank = 0;
      },
      (value: ReturnType<typeof pack>) => {
        value.hooks[0].rank = 1.5;
      },
      (value: ReturnType<typeof pack>) => {
        value.hooks[0].spoken = value.hooks[1].spoken.toUpperCase();
      },
      (value: ReturnType<typeof pack>) => {
        value.hooks[0].screenText = value.hooks[1].screenText;
      },
      (value: ReturnType<typeof pack>) => {
        value.alternateCtas[1] = value.alternateCtas[0];
      },
    ]) {
      const value = pack();
      mutation(value);
      expect(normalizeScriptWritingPack(value, 30)).toBeUndefined();
    }
  });
  it("bounds every text field, row count and combined response instead of truncating a writing plan", () => {
    for (const mutation of [
      (value: ReturnType<typeof pack>) => {
        value.hooks[0].spoken = "x".repeat(161);
      },
      (value: ReturnType<typeof pack>) => {
        value.hooks[0].screenText = "x".repeat(81);
      },
      (value: ReturnType<typeof pack>) => {
        value.hooks[0].reason = "x".repeat(281);
      },
      (value: ReturnType<typeof pack>) => {
        value.beats[0].visual = "x".repeat(601);
      },
      (value: ReturnType<typeof pack>) => {
        value.beats[0].spoken = "";
      },
      (value: ReturnType<typeof pack>) => {
        value.beats = Array.from({ length: 25 }, (_, index) => ({
          ...value.beats[0],
          start: index,
          end: index + 1,
        }));
      },
      (value: ReturnType<typeof pack>) => {
        value.scriptText = "x".repeat(23_000);
      },
    ]) {
      const value = pack();
      mutation(value);
      expect(normalizeScriptWritingPack(value, 30)).toBeUndefined();
    }
  });
  it("does not invent a pack for legacy responses or call observed timecodes planned", () => {
    expect(normalizeScriptWritingPack(undefined, 30)).toBeUndefined();
    expect(
      normalizeScriptWritingPack({ ...pack(), clock: "source" }, 30)
    ).toBeUndefined();
    expect(
      normalizeScriptWritingPack({ ...pack(), scriptText: undefined }, 30)
    ).toBeUndefined();
  });
  it("requires the beat narration to match the original script and tolerates only whitespace differences", () => {
    const value = pack();
    value.scriptText =
      "Try this.\n\nWatch the demonstration.\t Save the steps.";
    expect(normalizeScriptWritingPack(value, 30)).toBeDefined();
    value.beats[1].spoken = "A different story.";
    expect(normalizeScriptWritingPack(value, 30)).toBeUndefined();
  });
  it("allows a beat with no proposed text overlay without inventing screen text", () => {
    const value = pack();
    value.beats[1].screenText = "";
    expect(normalizeScriptWritingPack(value, 30)?.beats[1].screenText).toBe("");
  });
});
