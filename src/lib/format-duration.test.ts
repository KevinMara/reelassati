import { describe, expect, it } from "vitest";
import { formatMinutesDuration } from "./format-duration";

describe("localized whole-minute durations", () => {
  it.each([
    ["it", "1 h 2 min"],
    ["he", "1 שעה 2 דק׳"],
    ["ar", "1 س 2 د"],
  ])("formats mixed hours and minutes in %s", (locale, expected) => {
    expect(formatMinutesDuration(62, locale)).toBe(expected);
  });

  it.each([
    ["en", "0 min"],
    ["it", "0 min"],
    ["he", "0 דק׳"],
    ["ar", "0 د"],
  ])("keeps a localized minute unit for zero in %s", (locale, expected) => {
    expect(formatMinutesDuration(0, locale)).toBe(expected);
  });

  it.each([
    ["en", "1 hr"],
    ["it", "1 h"],
    ["he", "1 שעה"],
    ["ar", "1 س"],
  ])("omits zero minutes after a whole hour in %s", (locale, expected) => {
    expect(formatMinutesDuration(60, locale)).toBe(expected);
  });
});
