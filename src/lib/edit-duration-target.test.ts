import { describe, expect, it } from "vitest";
import {
  editDurationDirection,
  resolveEditDurationTarget,
} from "./edit-duration-target";

describe("content-aware edit duration preferences", () => {
  it("lets no-target mode ignore stale or empty range fields", () => {
    expect(resolveEditDurationTarget("none", "", "")).toEqual({ mode: "none" });
    expect(resolveEditDurationTarget("none", NaN, -1)).toEqual({
      mode: "none",
    });
  });

  it("preserves fractional seconds and supports clips shorter than a second", () => {
    expect(resolveEditDurationTarget("range", "0.125", "0.85")).toEqual({
      mode: "range",
      minimumSeconds: 0.125,
      maximumSeconds: 0.85,
    });
    expect(resolveEditDurationTarget("range", 14.175354, 28.350708)).toEqual({
      mode: "range",
      minimumSeconds: 14.175354,
      maximumSeconds: 28.350708,
    });
  });

  it("does not introduce a fixed 180-second cap for long-form edits", () => {
    expect(resolveEditDurationTarget("range", 300, 900)).toEqual({
      mode: "range",
      minimumSeconds: 300,
      maximumSeconds: 900,
    });
  });

  it.each([
    ["", "20"],
    ["10", ""],
    [" ", "20"],
    ["0", "20"],
    ["-1", "20"],
    ["10", "0"],
    ["ten", "20"],
    [NaN, 20],
    [10, NaN],
    [Infinity, 20],
    [10, Infinity],
    [10, 10],
    [20, 10],
  ])(
    "rejects invalid or non-ordered bounds before a run (%s, %s)",
    (min, max) => {
      expect(resolveEditDurationTarget("range", min, max)).toBeNull();
    }
  );

  it.each([true, false])(
    "sends an explicit unconstrained brief independent of ending detection (%s)",
    automaticEnding => {
      const direction = editDurationDirection(
        { mode: "none" },
        automaticEnding
      );
      expect(direction).toContain("No requested duration constraint.");
      expect(direction).toContain("do not impose a hidden exact target");
      expect(direction).not.toMatch(/\d/);
      expect(direction).toContain("Never pad, repeat or stretch footage");
      expect(direction).toContain("complete speech");
    }
  );

  it("communicates both precise bounds as a soft preference without truncating or filling", () => {
    const target = resolveEditDurationTarget("range", "0.125", "0.85");
    if (!target) throw new Error("Valid range expected");
    const direction = editDurationDirection(target, true);
    expect(direction).toContain("0.125–0.85 seconds");
    expect(direction).toContain("soft, content-aware preference");
    expect(direction).toContain("not an exact target or a hard cutoff");
    expect(direction).toContain("explain the tradeoff");
    expect(direction).toContain("Never pad, repeat or stretch footage");
    expect(direction).toContain("cut speech mid-word");
    expect(direction).toContain("Detect the last meaningful ending");
  });

  it("keeps meaningful-ending detection separate from the requested duration mode", () => {
    const target = resolveEditDurationTarget("range", 15.5, 25.75);
    if (!target) throw new Error("Valid range expected");
    const direction = editDurationDirection(target, false);
    expect(direction).toContain("15.5–25.75 seconds");
    expect(direction).toContain(
      "Automatic meaningful-ending detection is off."
    );
    expect(direction).toContain("Preserve intentional pauses");
  });

  it("refuses a malformed range even if a caller bypasses the form validator", () => {
    expect(() =>
      editDurationDirection(
        { mode: "range", minimumSeconds: 25, maximumSeconds: 10 },
        true
      )
    ).toThrow("Invalid edit duration preference");
  });
});
