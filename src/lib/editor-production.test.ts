import { describe, expect, it } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { auditAutomatedEdit, trimObservedEnding } from "./editor-production";
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
  it("does not count footage hidden by picture solo or outside the output clock as surviving picture", () => {
    const visible = { ...clip, track: "video" as const, lane: 1 };
    const hidden = { ...visible, id: "hidden", hidden: true };
    const before = {
      ...project,
      duration: 10,
      clips: [visible, hidden],
      trackSettings: [{ kind: "video" as const, number: 1, soloPicture: true }],
    };
    const replacement = { ...visible, id: "replacement", lane: 2 };
    const soloResult = { ...before, clips: [hidden, replacement] };
    expect(auditAutomatedEdit(before, soloResult, assets)).toContain(
      "The edit removed all visible picture content"
    );
    expect(
      auditAutomatedEdit(before, { ...soloResult, trackSettings: [] }, assets)
    ).toEqual([]);
    expect(
      auditAutomatedEdit(
        before,
        { ...before, clips: [{ ...visible, start: 10 }] },
        assets
      )
    ).toContain("The edit removed all visible picture content");
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
  it("rejects a new cut through a word while allowing continuous splits", () => {
    const source = { ...clip, start: 0, duration: 4, inPoint: 0, outPoint: 4 };
    const before = {
      ...project,
      clips: [source],
      sourceSpeech: [
        {
          assetId: "media",
          segments: [
            {
              id: "speech",
              start: 1,
              end: 2,
              text: "parola",
              words: [{ text: "parola", start: 1, end: 2 }],
            },
          ],
        },
      ],
    };
    expect(
      auditAutomatedEdit(
        before,
        { ...before, clips: [{ ...source, inPoint: 1.5, duration: 2.5 }] },
        assets
      )
    ).toContain("Cut crosses a spoken word: Source");
    const split = {
      ...before,
      clips: [
        { ...source, id: "left", duration: 1.5, outPoint: 1.5 },
        { ...source, id: "right", start: 1.5, inPoint: 1.5, duration: 2.5 },
      ],
    };
    expect(auditAutomatedEdit(before, split, assets)).toEqual([]);
  });
  it("protects measured speech when an observed visual ending is earlier", () => {
    const source = {
      ...clip,
      start: 0,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
    };
    const base = {
      ...project,
      clips: [source],
      duration: 10,
      transcript: [],
      sourceReviews: [
        {
          assetId: "media",
          reviewedAt: "2026-10-25T00:00:00Z",
          summary: "Observed",
          captions: "present",
          captionNote: "Burned in",
          audio: "present",
          audioNote: "Speech",
          moments: [],
          ending: {
            time: 5,
            confidence: 0.99,
            completed: true,
            trailingContent: "empty",
            note: "Empty visual tail",
          },
        },
      ],
    } as EditProject;
    const spoken = {
      ...base,
      sourceSpeech: [
        {
          assetId: "media",
          segments: [{ id: "last", start: 8, end: 9.5, text: "fine." }],
        },
      ],
    };
    expect(trimObservedEnding(base, assets).duration).toBeCloseTo(5.2);
    expect(trimObservedEnding(spoken, assets).duration).toBeCloseTo(9.65);
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
