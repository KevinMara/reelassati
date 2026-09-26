import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import type { EditProject, TimelineClip, Asset } from "@contracts/workspace";
import {
  deleteClipGroup,
  detachClipAudio,
  moveClipGroup,
  pasteClipGroup,
  replaceTimelineClip,
} from "./editor-manual";
import { trimTimelineClip } from "./timeline-lanes";
import { captionIssues, mergeCaptions, splitCaption } from "./caption-editing";
import { colorGradeFilter, colorGradeMatrix } from "./color-grade";
import { normalizeEditorChatState } from "@contracts/editor-chat-state";
import {
  editorChatCanExecute,
  editorChatRunStatus,
} from "@contracts/editor-chat";
import { parseEditorChatRequest } from "../../sites/editor-chat";
import {
  choreographGraphic,
  graphicFrame,
  MOTION_CHOREOGRAPHIES,
  normalizeGraphic,
} from "@contracts/motion-graphics";
const clip = (id = "v", extra: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  track: "video",
  assetId: "source",
  label: id,
  start: 0,
  duration: 10,
  inPoint: 0,
  outPoint: 10,
  lane: 1,
  color: "#ffffff",
  locked: false,
  ...extra,
});
const project = (clips = [clip()]): EditProject => ({
  id: "p",
  title: "Test",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 30,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  clips,
  transcript: [{ id: "cue", text: "Hello world", start: 2, end: 4 }],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
});
const request = {
  requestId: "test-upgrade-request",
  projectId: "p",
  prompt: "Edit the clip",
  mode: "ask" as const,
  maxCredits: 200,
};

describe("manual editing preserves media and speech", () => {
  it("music deletion, trim and movement do not affect speech captions", () => {
    const p = project([
      clip(),
      clip("music", { track: "audio", assetId: "music" }),
    ]);
    expect(deleteClipGroup(p, ["music"]).transcript).toEqual(p.transcript);
    expect(
      replaceTimelineClip(p, "music", { ...p.clips[1], start: 5 }).transcript
    ).toEqual(p.transcript);
    expect(moveClipGroup(p, ["music"], "music", 5, 1).transcript).toEqual(
      p.transcript
    );
  });
  it("tracks detached speech separately from the muted image", () => {
    const p = project();
    const detached = detachClipAudio(
      p,
      "v",
      [{ id: "source", kind: "video" } as Asset],
      "speech"
    );
    expect(detached.clips[0].muted).toBe(true);
    expect(deleteClipGroup(detached, ["v"]).transcript).toEqual([
      { ...p.transcript[0], sourceClipId: "speech" },
    ]);
    expect(
      moveClipGroup(detached, ["speech"], "speech", 3, 1).transcript[0]
    ).toMatchObject({ start: 5, end: 7 });
  });
  it("does not truncate cross-cut captions for a name or look adjustment", () => {
    const p = project();
    p.transcript[0].end = 12;
    expect(
      replaceTimelineClip(p, "v", {
        ...p.clips[0],
        label: "Renamed",
        brightness: 0.1,
      }).transcript
    ).toEqual(p.transcript);
  });
  it("maps source time through trim and speed changes and restores source handles", () => {
    const p = project();
    const replacement = {
      ...p.clips[0],
      start: 5,
      inPoint: 1,
      outPoint: 9,
      speed: 2,
      duration: 4,
    };
    expect(
      replaceTimelineClip(p, "v", replacement).transcript[0]
    ).toMatchObject({ start: 5.5, end: 6.5 });
    expect(
      trimTimelineClip(clip("v", { outPoint: 5, duration: 5 }), "end", 8, 10)
    ).toMatchObject({ duration: 8, outPoint: 8 });
  });
  it("preserves relative layers and offsets when dragging a group downward", () => {
    const p = project([clip(), clip("upper", { lane: 2, start: 1 })]);
    const moved = moveClipGroup(p, ["v", "upper"], "upper", 4, 1);
    expect(moved.clips.map(c => [c.start, c.lane])).toEqual([
      [3, 1],
      [4, 2],
    ]);
    expect(moved.transcript[0]).toMatchObject({ start: 5, end: 7 });
    expect(() =>
      moveClipGroup(project([clip("v", { locked: true })]), ["v"], "v", 1, 1)
    ).toThrow(/Unlock/);
  });
  it("copies a group once, keeps layer spacing and duplicates owned captions", () => {
    const p = project([clip(), clip("upper", { lane: 2, start: 1 })]);
    let n = 0;
    const pasted = pasteClipGroup(p, p.clips, 12, () => `copy-${++n}`);
    expect(pasted.project.clips.slice(2).map(c => [c.start, c.lane])).toEqual([
      [12, 1],
      [13, 2],
    ]);
    expect(pasted.project.transcript.map(s => [s.start, s.end])).toEqual([
      [2, 4],
      [14, 16],
    ]);
  });
});
describe("caption and motion authoring", () => {
  it("splits at a word boundary and merges without losing words", () => {
    const cue = { id: "c", start: 1, end: 5, text: "The next chapter begins" };
    const split = splitCaption(cue, 9, 3, "right");
    expect(split.map(c => c.text)).toEqual(["The next", "chapter begins"]);
    expect(mergeCaptions(split[0], split[1])).toMatchObject(cue);
    expect(() => splitCaption(cue, 0, 3, "x")).toThrow(/cursor/);
    expect(captionIssues({ ...cue, end: 1 }, [], 10)).toContain(
      "Set a valid time range inside the edit."
    );
  });
  it("renders choreographed opacity with a readable hold and deliberate exit", () => {
    for (const { id } of MOTION_CHOREOGRAPHIES) {
      const g = choreographGraphic(
        normalizeGraphic({
          kind: "callout",
          text: "Actual message",
          animation: "none",
        })!,
        id
      );
      expect(normalizeGraphic(g)).toEqual(g);
      expect(graphicFrame(g, 0, 4).opacity).toBe(0);
      expect(graphicFrame(g, 2, 4).opacity).toBeCloseTo(1);
      expect(graphicFrame(g, 4, 4).opacity).toBe(0);
    }
  });
});
describe("Reel preferences and plan safety", () => {
  it("migrates the old default but preserves a newly chosen 100-credit cap", () => {
    expect(
      normalizeEditorChatState({ mode: "ask", maxCredits: 100, messages: [] })
        ?.maxCredits
    ).toBe(200);
    expect(
      normalizeEditorChatState({
        mode: "ask",
        maxCredits: 100,
        messages: [],
        preferencesVersion: 2,
      })?.maxCredits
    ).toBe(100);
  });
  it("keeps legacy request fingerprints stable and validates structured presets", () => {
    expect(parseEditorChatRequest(request).executionMode).toBeUndefined();
    expect(
      parseEditorChatRequest({
        ...request,
        taskPreset: "motion",
        executionMode: "plan",
      })
    ).toMatchObject({ taskPreset: "motion", executionMode: "plan" });
    expect(() =>
      parseEditorChatRequest({ ...request, taskPreset: "reveal-platform" })
    ).toThrow();
  });
  it("never executes an unapplied plan and never labels blocked steps completed", () => {
    expect(
      editorChatCanExecute({ request: { ...request, executionMode: "plan" } })
    ).toBe(false);
    expect(
      editorChatCanExecute({
        request: { ...request, executionMode: "plan" },
        planApproved: true,
      })
    ).toBe(true);
    expect(editorChatCanExecute({ request })).toBe(true);
    expect(editorChatRunStatus([], ["Unsupported operation"])).toBe("failed");
  });
});
it("exports the same colored-pixel transform used by the browser", () => {
  const grade = { brightness: 0.08, contrast: 1.5, saturation: 1.4 };
  const source = [32, 64, 128],
    m = colorGradeMatrix(grade);
  const expected = [0, 1, 2].map(row =>
    Math.max(
      0,
      Math.min(
        255,
        source.reduce(
          (sum, v, col) => sum + v * m[row * 5 + col],
          255 * m[row * 5 + 4]
        )
      )
    )
  );
  const pixels = Buffer.from(
    Array.from({ length: 16 }, () => [...source, 255]).flat()
  );
  const rendered = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-threads",
      "1",
      "-filter_threads",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      "4x4",
      "-i",
      "pipe:0",
      "-vf",
      colorGradeFilter(grade),
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "pipe:1",
    ],
    { input: pixels }
  );
  expected.forEach((value, col) =>
    expect(Math.abs(rendered[col] - value)).toBeLessThanOrEqual(2)
  );
  expect(rendered[3]).toBe(255);
});
