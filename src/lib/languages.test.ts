import { describe, expect, it } from "vitest";
import { CONTENT_LANGUAGES, WRITING_LANGUAGES, languageLabel } from "./languages";

describe("language catalog", () => {
  it("offers a broad, duplicate-free writing catalog", () => {
    const codes = WRITING_LANGUAGES.map((language) => language.code);
    expect(codes.length).toBeGreaterThanOrEqual(50);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain("auto");
  });

  it("keeps auto-detection available only in the complete catalog", () => {
    expect(CONTENT_LANGUAGES[0]).toEqual({
      code: "auto",
      label: "Auto-detect",
    });
    expect(languageLabel("it")).toContain("Italiano");
    expect(languageLabel("unknown")).toBe("UNKNOWN");
  });
});
