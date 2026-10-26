import { describe, expect, it } from "vitest";
import type { EditProject } from "./workspace";
import {
  applyAutonomousCaptionTreatment,
  autonomousCaptionDirection,
  canStyleAutonomousCaptions,
  normalizeAutonomousCaptionTreatment,
} from "./editorial-captions";

const project = {
  clips: [],
  transcript: [
    {
      id: "speech",
      start: 0,
      end: 2,
      text: "Un esempio",
      words: [
        { text: "Un", start: 0, end: 0.5 },
        { text: "esempio", start: 0.5, end: 2 },
      ],
    },
  ],
  captionStyle: "classic",
  captionAppearance: { color: "#FFFFFF" },
} as unknown as EditProject;
const treatment = {
  preset: "word-mint",
  appearance: { size: 5, position: "top", margin: 15 },
};

describe("content-specific automatic caption treatment", () => {
  it("requires explicit opt-in and actual editable captions", () => {
    expect(canStyleAutonomousCaptions(project, false)).toBe(false);
    expect(canStyleAutonomousCaptions(project, true)).toBe(true);
    expect(
      canStyleAutonomousCaptions({ ...project, transcript: [] }, true)
    ).toBe(false);
    expect(autonomousCaptionDirection(project, true)).toContain(
      "optional top-level captionTreatment"
    );
    expect(
      autonomousCaptionDirection({ ...project, transcript: [] }, true)
    ).toContain("Do not return captionTreatment");
  });
  it("applies normalized presentation only, preserving the complete words and their measured times", () => {
    const before = structuredClone(project);
    const styled = applyAutonomousCaptionTreatment(project, treatment);
    expect(styled).toMatchObject({
      captionStyle: "word-mint",
      captionAppearance: {
        size: 5,
        position: "top",
        margin: 15,
        animation: "active-word",
      },
    });
    expect(styled.transcript).toBe(project.transcript);
    expect(styled.clips).toBe(project.clips);
    expect(project).toEqual(before);
  });
  it("disables word animation when timing is missing, incomplete or outside the phrase", () => {
    for (const words of [
      undefined,
      [{ text: "Un", start: 0, end: 0.5 }],
      [
        { text: "Un", start: -1, end: 0.5 },
        { text: "esempio", start: 0.5, end: 2 },
      ],
    ]) {
      const untimed = {
        ...project,
        transcript: [{ ...project.transcript[0], words }],
      };
      expect(
        normalizeAutonomousCaptionTreatment(untimed, treatment)?.appearance
          .animation
      ).toBe("none");
      expect(untimed.transcript[0].words).toEqual(words);
    }
  });
  it("preserves explicit template treatment and avoids burned caption collisions", () => {
    const template = {
      profile: {
        captionTreatment: { preset: "editorial", appearance: { size: 4 } },
      },
    } as EditProject["editStyleTemplate"];
    const explicit = { ...project, editStyleTemplate: template };
    expect(applyAutonomousCaptionTreatment(explicit, treatment)).toBe(explicit);
    const burned = {
      ...project,
      sourceReviews: [{ captions: "present" }],
    } as EditProject;
    expect(
      normalizeAutonomousCaptionTreatment(burned, treatment)
    ).toBeUndefined();
    expect(autonomousCaptionDirection(burned, true)).toContain(
      "Do not return captionTreatment"
    );
  });
  it("rejects nonexistent presets and strips unsupported fields without inventing caption text", () => {
    expect(
      normalizeAutonomousCaptionTreatment(project, { preset: "make-it-viral" })
    ).toBeUndefined();
    const normalized = normalizeAutonomousCaptionTreatment(project, {
      preset: "classic",
      text: "Invented dialogue",
      appearance: {
        size: 100,
        color: "script()",
        animation: "tracking",
        custom: true,
      },
    });
    expect(normalized?.appearance).toMatchObject({
      size: 12,
      color: "#FFFFFF",
      animation: "none",
    });
    expect(normalized).not.toHaveProperty("text");
    expect(normalized?.appearance).not.toHaveProperty("custom");
  });
});
