import { describe, expect, it } from "vitest";
import type { EditProject, TimelineClip } from "@contracts/workspace";
import {
  splitClipGroup,
  pasteClipGroup,
  replaceTimelineClip,
  toggleTimelineLane,
} from "./editor-manual";
import { buildRenderPlan } from "./render-plan";
import type { Asset } from "@contracts/workspace";
import { rippleDeleteSelection, applyEditOperation } from "./edit-timeline";
import { mergeChatTranscript } from "./editor-chat-safety";
import { mergeCaptions } from "./caption-editing";

const clip = (id: string, extra: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  label: id,
  track: "video",
  start: 0,
  duration: 4,
  inPoint: 10,
  outPoint: 14,
  lane: 1,
  locked: false,
  color: "#ffffff",
  ...extra,
});
const p = (): EditProject => ({
  id: "p",
  title: "Test",
  status: "editing",
  template: "blank",
  platform: "instagram",
  aspectRatio: "1:1",
  duration: 10,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  revisions: [],
  qualitySignals: [],
  proposedChanges: [],
  clips: [clip("speech"), clip("music", { track: "audio" })],
  transcript: [
    {
      id: "cue",
      sourceClipId: "speech",
      text: "First second third fourth",
      start: 0,
      end: 4,
      words: [
        { text: "First", start: 0, end: 0.8 },
        { text: "second", start: 1, end: 1.8 },
        { text: "third", start: 2, end: 2.8 },
        { text: "fourth", start: 3, end: 3.8 },
      ],
    },
  ],
});

describe("speech clocks survive structural edits", () => {
  it("splits the whole selection and lets the right cue follow later trims", () => {
    let n = 0;
    const split = splitClipGroup(
      p(),
      ["speech", "music"],
      2,
      () => `right-${++n}`
    );
    expect(split.ids).toHaveLength(2);
    expect(split.project.clips.map(c => [c.id, c.inPoint, c.outPoint])).toEqual(
      [
        ["speech", 10, 12],
        ["right-1", 12, 14],
        ["music", 10, 12],
        ["right-2", 12, 14],
      ]
    );
    expect(split.project.transcript.map(s => [s.text, s.sourceClipId])).toEqual(
      [
        ["First second", "speech"],
        ["third fourth", "right-1"],
      ]
    );
    const right = split.project.clips.find(c => c.id === "right-1")!;
    const trimmed = replaceTimelineClip(split.project, right.id, {
      ...right,
      start: 5,
      inPoint: 13,
      duration: 1,
    });
    expect(trimmed.transcript[1]).toMatchObject({
      text: "fourth",
      start: 5,
      end: 6,
      sourceClipId: "right-1",
    });
    expect(trimmed.transcript[1].words?.[0]).toMatchObject({
      text: "fourth",
      start: 5,
    });
    expect(trimmed.transcript[1].words?.[0].end).toBeCloseTo(5.8);
  });
  it("keeps owned speech captions when an occupied paste moves to lane two", () => {
    let n = 0;
    const pasted = pasteClipGroup(p(), [p().clips[0]], 1, () => `copy-${++n}`);
    const copied = pasted.project.clips.find(c => c.id === pasted.ids[0])!;
    expect(copied.lane).toBe(2);
    expect(
      pasted.project.transcript.find(s => s.sourceClipId === copied.id)
    ).toMatchObject({ text: "First second third fourth", start: 1, end: 5 });
  });
  it("ripple removes measured words and preserves ownership on the new right piece", () => {
    const source = p();
    source.clips.push(
      clip("cut", {
        track: "overlay",
        start: 1,
        duration: 1,
        inPoint: 0,
        outPoint: 1,
      })
    );
    const cut = rippleDeleteSelection(source, ["cut"]);
    expect(cut.duration).toBe(9);
    expect(cut.transcript.map(s => s.text)).toEqual(["First", "third fourth"]);
    expect(cut.transcript[1]).toMatchObject({
      start: 1,
      end: 3,
      sourceClipId: "speech-after-2",
    });
    expect(cut.transcript[1].words?.map(w => w.start)).toEqual([1, 2]);
    expect(cut.clips.find(c => c.id === "speech")?.fadeOut).toBe(0);
  });
  it("does not ripple-delete unselected gaps between two selections", () => {
    const source = p();
    source.clips = [
      clip("a", { start: 1, duration: 1, inPoint: 0, outPoint: 1 }),
      clip("b", { start: 5, duration: 1, inPoint: 0, outPoint: 1 }),
    ];
    source.transcript = [];
    expect(rippleDeleteSelection(source, ["a", "b"]).duration).toBe(8);
    expect(() =>
      rippleDeleteSelection(
        {
          ...source,
          clips: [...source.clips, clip("locked", { start: 8, locked: true })],
        },
        ["a"]
      )
    ).toThrow(/Unlock/);
  });
  it("AI split and local style segmentation project cue ownership onto every piece", () => {
    const source = p();
    const op = {
      id: "op",
      type: "style" as const,
      start: 1,
      end: 3,
      label: "look",
      reason: "test",
      intensity: "balanced" as const,
      status: "proposed" as const,
      confidence: 1,
      targetClipIds: ["speech"],
      parameters: { brightness: 0.1 },
    };
    const changed = applyEditOperation(source, op);
    expect(changed.clips.filter(c => c.track === "video")).toHaveLength(3);
    for (const cue of changed.transcript)
      expect(
        changed.clips.some(
          c =>
            c.id === cue.sourceClipId &&
            c.start <= cue.start &&
            c.start + c.duration >= cue.end
        )
      ).toBe(true);
    expect(changed.transcript.map(s => s.text).join(" ")).toBe(
      source.transcript[0].text
    );
  });
  it("range transcription keeps only the actual words in each retained portion", () => {
    const source = p();
    const kept = mergeChatTranscript(source, [], true, { start: 1, end: 3 });
    expect(kept.map(s => s.text)).toEqual(["First", "fourth"]);
    expect(() =>
      mergeCaptions(source.transcript[0], {
        ...source.transcript[0],
        sourceClipId: "other",
      })
    ).toThrow(/different source/);
  });
  it("track visibility preserves sound, mute preserves silent handles, and locks guard both", () => {
    const source = p();
    source.clips = source.clips.map(c => ({ ...c, assetId: "v" }));
    source.clips.push(
      clip("handle", { assetId: "v", transitionHandle: true, muted: true })
    );
    const hidden = toggleTimelineLane(
      source,
      { kind: "video", number: 1 },
      "hidden"
    );
    expect(
      hidden.clips.filter(c => c.track === "video").every(c => c.hidden)
    ).toBe(true);
    const plan = buildRenderPlan(
      hidden,
      [{ id: "v", kind: "video", status: "ready", duration: 20 } as Asset],
      new Set(["v"])
    );
    expect(plan.args.join(" ")).not.toContain(":v]trim=");
    const unmuted = toggleTimelineLane(
      { ...source, clips: source.clips.map(c => ({ ...c, muted: true })) },
      { kind: "video", number: 1 },
      "muted"
    );
    expect(unmuted.clips.find(c => c.id === "handle")?.muted).toBe(true);
    expect(unmuted.clips.find(c => c.id === "speech")?.muted).toBe(false);
    const locked = toggleTimelineLane(
      source,
      { kind: "video", number: 1 },
      "locked"
    );
    expect(() =>
      toggleTimelineLane(locked, { kind: "video", number: 1 }, "hidden")
    ).toThrow(/Unlock/);
  });
});
