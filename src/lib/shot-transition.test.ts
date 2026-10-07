import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyAdjacentTransition,
  adjacentTransitionHandleIds,
  removeAdjacentTransition,
} from "@contracts/adjacent-transition";
import { visualFrame, normalizeVisual } from "@contracts/clip-visual";
import { isPrimaryFootage } from "@contracts/timeline-layers";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";
import {
  deleteClipGroup,
  moveClipGroup,
  replaceTimelineClip,
  splitClipGroup,
  pasteClipGroup,
} from "./editor-manual";
import {
  applyEditOperation,
  rippleRemove,
  resizeTimeline,
} from "./edit-timeline";
import {
  normalizeEditorChatPlan,
  type EditorChatContext,
} from "../../sites/editor-chat";
const shot = (id: string, start: number): TimelineClip => ({
  id,
  assetId: id,
  track: "video",
  lane: 1,
  label: id,
  start,
  duration: 1,
  inPoint: 1,
  outPoint: 2,
  locked: false,
  color: "#ffffff",
  volume: 0.8,
});
const assets = ["red", "blue"].map(
  id => ({ id, kind: "video", status: "ready", duration: 4 }) as Asset
);
const project = (): EditProject => ({
  id: "p",
  title: "Test",
  status: "editing",
  template: "blank",
  platform: "instagram",
  aspectRatio: "1:1",
  duration: 2,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  revisions: [],
  qualitySignals: [],
  proposedChanges: [],
  clips: [shot("red", 0), shot("blue", 1)],
  transcript: [{ id: "cue", start: 1.2, end: 1.8, text: "Actual speech" }],
});
const apply = (p = project(), duration = 0.4) =>
  applyAdjacentTransition(p, assets, "red", "blue", "dissolve", duration);
describe("source-handle transitions", () => {
  it("blocks stale handles during structural changes and removes them before later edits", () => {
    const p = apply(),
      blue = p.clips.find(c => c.id === "blue")!;
    const changes = [
      () => moveClipGroup(p, ["blue"], "blue", 1.5, 2),
      () =>
        replaceTimelineClip(p, "blue", {
          ...blue,
          duration: 0.5,
          outPoint: 1.5,
        }),
      () => splitClipGroup(p, ["blue"], 1.5, () => "new"),
      () => rippleRemove(p, 0.25, 0.5),
      () => resizeTimeline(p, 1.5),
      () =>
        applyEditOperation(p, {
          id: "m",
          type: "move",
          label: "Move",
          reason: "Requested",
          status: "proposed",
          confidence: 1,
          intensity: "balanced",
          start: 1,
          end: 2,
          targetClipIds: ["blue"],
          parameters: { destination: 1.5 },
        }),
    ];
    for (const change of changes)
      expect(change).toThrow(/Remove the transition/);
    const restored = removeAdjacentTransition(p, "red", "blue");
    expect(restored.clips).toHaveLength(2);
    expect(
      restored.clips.find(c => c.id === "blue")?.shotTransition
    ).toBeUndefined();
    expect(
      moveClipGroup(restored, ["blue"], "blue", 1.5, 2).clips.find(
        c => c.id === "blue"
      )?.start
    ).toBe(1.5);
    let id = 0;
    const pasted = pasteClipGroup(p, [blue], 2, () => `copy${id++}`).project;
    const copy = pasted.clips.find(c => c.id === "copy0")!;
    expect(copy.shotTransition).toBeUndefined();
    expect(copy.visual?.entrance.kind).toBe("none");
    expect(pasted.clips.filter(c => c.transitionHandle)).toHaveLength(2);
  });
  it("restores previous effects on removal and respects locked generated handles", () => {
    const original = project();
    original.clips[0].visual = normalizeVisual({
      exit: { kind: "wipe-left", duration: 0.2 },
    });
    original.clips[1].visual = normalizeVisual({
      entrance: { kind: "zoom", duration: 0.3 },
    });
    const p = apply(original),
      restored = removeAdjacentTransition(p, "red", "blue");
    expect(restored.clips[0].visual?.exit).toEqual(
      original.clips[0].visual.exit
    );
    expect(restored.clips[1].visual?.entrance).toEqual(
      original.clips[1].visual.entrance
    );
    const locked = {
      ...p,
      clips: p.clips.map(c =>
        c.transitionHandle ? { ...c, locked: true } : c
      ),
    };
    expect(() => removeAdjacentTransition(locked, "red", "blue")).toThrow(
      /Unlock/
    );
  });
  it("centers a continuous blend without changing main footage, speech or edit length", () => {
    const p = project(),
      result = apply(p),
      ids = adjacentTransitionHandleIds("red", "blue");
    const incoming = result.clips.find(c => c.id === "blue")!,
      handle = result.clips.find(c => c.id === ids.incoming)!;
    expect(visualFrame(handle, 0.8).opacity).toBeCloseTo(0);
    expect(visualFrame(handle, 0.9).opacity).toBeCloseTo(0.25);
    expect(visualFrame(incoming, 1).opacity).toBeCloseTo(0.5);
    expect(visualFrame(incoming, 1.2).opacity).toBeCloseTo(1);
    expect(result.duration).toBe(p.duration);
    for (const original of p.clips)
      expect(result.clips.find(c => c.id === original.id)).toMatchObject({
        start: original.start,
        duration: original.duration,
        inPoint: original.inPoint,
        outPoint: original.outPoint,
        volume: 0.8,
      });
    expect(result.transcript).toEqual([
      { ...p.transcript[0], sourceClipId: "blue" },
    ]);
    expect(() => deleteClipGroup(result, ["blue"])).toThrow(
      /Remove the transition/
    );
    expect(
      deleteClipGroup(removeAdjacentTransition(result, "red", "blue"), ["blue"])
        .transcript
    ).toEqual([]);
    expect(
      result.clips.filter(c => c.transitionHandle).every(c => c.muted)
    ).toBe(true);
    expect(result.clips.filter(isPrimaryFootage).map(c => c.id)).toEqual([
      "red",
      "blue",
    ]);
  });
  it("reapplies without duplication and repairs ordering after an outgoing lane move", () => {
    const p = apply();
    const next = apply({
      ...p,
      clips: p.clips.map(c => (c.id === "red" ? { ...c, lane: 3 } : c)),
    });
    expect(next.clips).toHaveLength(4);
    expect(next.clips.find(c => c.id === "blue")?.lane).toBe(4);
    expect(apply(next)).toEqual(next);
  });
  it("rejects locked handles, impossible source bounds, overlaps and malformed timing", () => {
    const p = apply(),
      id = adjacentTransitionHandleIds("red", "blue").incoming;
    expect(() =>
      apply({
        ...p,
        clips: p.clips.map(c => (c.id === id ? { ...c, locked: true } : c)),
      })
    ).toThrow(/Unlock/);
    expect(() =>
      apply({
        ...project(),
        clips: [
          shot("red", 0),
          { ...shot("blue", 1), inPoint: 0, outPoint: 1 },
        ],
      })
    ).toThrow(/unused source/);
    expect(() =>
      apply({
        ...project(),
        clips: [...project().clips, { ...shot("broll", 1), lane: 3 }],
      })
    ).toThrow(/overlaps/);
    expect(() =>
      apply({
        ...project(),
        clips: [{ ...shot("red", 0), speed: 0 }, shot("blue", 1)],
      })
    ).toThrow(/timing/);
    expect(() => apply(project(), 1.1)).toThrow(/too long/);
  });
  it("server planning refuses targets and old effects outside a hard selection", () => {
    const p = project(),
      request = {
        requestId: "transition-test",
        projectId: "p",
        prompt: "dissolve these shots",
        mode: "ask" as const,
        maxCredits: 200,
        range: { start: 0.8, end: 1.2 },
      };
    const context: EditorChatContext = {
      request,
      project: p,
      assets,
      makeId: () => "action",
      normalizeOperations: () => [],
      quoteAudio: () => 0,
      capability: () => true,
    };
    const action = {
      id: "t",
      kind: "adjacent-transition",
      label: "Dissolve",
      scope: "requested",
      requestExcerpt: "dissolve these shots",
      dependsOn: [],
      outgoingId: "red",
      incomingId: "blue",
      transition: "dissolve",
      duration: 0.4,
    };
    expect(
      normalizeEditorChatPlan({ actions: [action] }, context).actions[0]
    ).toMatchObject({ kind: "adjacent-transition", credits: 0 });
    expect(
      normalizeEditorChatPlan(
        { actions: [action] },
        { ...context, request: { ...request, selectedClipIds: ["red"] } }
      ).actions
    ).toEqual([]);
    p.clips[0].visual = normalizeVisual({
      exit: { kind: "dissolve", duration: 0.5 },
    });
    expect(
      normalizeEditorChatPlan(
        { actions: [action] },
        context
      ).blockedReasons.join(" ")
    ).toMatch(/already has/);
  });
  it("renders the centered dissolve to actual MP4 pixels without adding duplicate audio", () => {
    const dir = mkdtempSync(join(tmpdir(), "reel-transition-"));
    try {
      for (const [index, color] of ["red", "blue"].entries())
        execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            `color=${color}:s=80x80:r=30:d=4`,
            "-f",
            "lavfi",
            "-i",
            `sine=frequency=${440 + 440 * index}:duration=4`,
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            "-f",
            "mp4",
            `input-${index}`,
          ],
          { cwd: dir }
        );
      const plan = buildRenderPlan(apply(), assets, new Set(["red", "blue"]));
      expect(plan.args.join(" ").match(/asetpts=/g)).toHaveLength(2);
      writeFileSync(join(dir, "captions.ass"), plan.ass);
      execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
        cwd: dir,
        timeout: 60000,
      });
      const bytes = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          "output.mp4",
          "-vf",
          "scale=8:8,select='eq(n,24)+eq(n,27)+eq(n,30)+eq(n,33)+eq(n,36)'",
          "-vsync",
          "0",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { cwd: dir }
      );
      expect(bytes.length).toBe(5 * 8 * 8 * 3);
      const pixels = Array.from({ length: 5 }, (_, i) => [
        ...bytes.subarray(i * 192 + 84, i * 192 + 87),
      ]);
      expect(pixels[0][0]).toBeGreaterThan(235);
      expect(pixels[0][2]).toBeLessThan(15);
      expect(pixels[2][0]).toBeGreaterThan(90);
      expect(pixels[2][0]).toBeLessThan(165);
      expect(pixels[2][2]).toBeGreaterThan(90);
      expect(pixels[2][2]).toBeLessThan(165);
      expect(pixels[4][2]).toBeGreaterThan(235);
      expect(pixels[4][0]).toBeLessThan(15);
      expect(pixels.map(p => p[2])).toEqual(
        [...pixels.map(p => p[2])].sort((a, b) => a - b)
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 65000);
});
