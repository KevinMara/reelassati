import { describe, expect, it } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { auditAutomatedEdit } from "./editor-production";
import { audioGenerationQuote } from "@contracts/audio-generation";

const clip = {
  id: "clip",
  label: "Source",
  assetId: "media",
  start: 0,
  duration: 8.3507,
  inPoint: 20,
  outPoint: 28.3507,
  speed: 1,
  locked: false,
} as TimelineClip;
const project = { clips: [clip] } as EditProject;
const assets = [{ id: "media", kind: "video", duration: 28.3507 }] as Asset[];
describe("automated edit delivery checks", () => {
  it("retains precise source endpoints without forcing display rounding onto media", () => {
    expect(auditAutomatedEdit(project, project, assets)).toEqual([]);
  });
  it("rejects source overruns at changed playback speeds", () => {
    expect(
      auditAutomatedEdit(
        project,
        { ...project, clips: [{ ...clip, speed: 2 }] },
        assets
      )
    ).toContain("Clip extends beyond its source: Source");
  });
  it("rejects removal or mutation of locked clips", () => {
    const locked = { ...project, clips: [{ ...clip, locked: true }] };
    expect(auditAutomatedEdit(locked, project, assets)).toContain(
      "Locked clip changed: Source"
    );
    expect(
      auditAutomatedEdit(locked, { ...project, clips: [] }, assets)
    ).toContain("Locked clip changed: Source");
  });
  it("rejects nonfinite timings and missing source media", () => {
    expect(
      auditAutomatedEdit(
        project,
        { ...project, clips: [{ ...clip, duration: NaN }] },
        []
      )
    ).toHaveLength(2);
  });
});
describe("AI audio credit quotes", () => {
  it("rounds delivery costs up to whole credits at the approved budget", () => {
    expect(audioGenerationQuote("music", 15, 0.01)).toBe(50);
    expect(audioGenerationQuote("sfx", 0.5, 0.01)).toBe(2);
  });
  it("rejects unavailable rates and durations beyond the provider limits", () => {
    for (const rate of [0, -1, NaN, Infinity])
      expect(() => audioGenerationQuote("music", 15, rate)).toThrow();
    expect(() => audioGenerationQuote("sfx", 31, 0.01)).toThrow();
    expect(() => audioGenerationQuote("music", 2, 0.01)).toThrow();
  });
});
