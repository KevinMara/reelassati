import { describe, expect, it } from "vitest";
import type { Asset, EditOperation, EditProject } from "@contracts/workspace";
import { editorAudioCatalog } from "@contracts/editor-audio-catalog";
import { auditAutomatedEdit } from "./editor-production";
import {
  assertAutonomousMediaBudget,
  executeAutonomousPlan,
  preflightAutonomousPlan,
} from "./autonomous-execution";

const asset = {
  id: "source",
  kind: "video",
  duration: 10,
  status: "ready",
} as Asset;
const project = {
  id: "project",
  duration: 10,
  playhead: 0,
  clips: [
    {
      id: "picture",
      assetId: "source",
      track: "video",
      lane: 1,
      label: "Picture",
      start: 0,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
      locked: false,
    },
  ],
  transcript: [],
  proposedChanges: [],
} as unknown as EditProject;
function op(
  id: string,
  type: EditOperation["type"],
  start: number,
  end: number,
  parameters: EditOperation["parameters"] = {}
): EditOperation {
  return {
    id,
    type,
    start,
    end,
    parameters,
    targetClipIds: ["picture"],
    label: id,
    reason: "Test",
    confidence: 1,
    intensity: "balanced",
    status: "proposed",
  };
}
describe("complete auto-edit draft execution", () => {
  it("ends a catalog cue at its real source boundary in preflight and execution without rewriting the signed proposal", () => {
    const entry = editorAudioCatalog.find(item => item.id === "zen-complete")!;
    const sound = {
      id: `catalog:${entry.id}`,
      kind: "audio",
      duration: entry.duration,
      status: "ready",
    } as Asset;
    const action = {
      ...op("completion", "sound", 8, 10, {
        assetId: sound.id,
        sourceIn: 0.1,
        volume: 0.15,
        fadeOut: 0.04,
      }),
      provenance: { id: "signed-plan" } as NonNullable<EditOperation["provenance"]>,
    };
    const original = structuredClone(action);
    const before = { ...project, proposedChanges: [action] };
    expect(() => preflightAutonomousPlan(before, [action], [asset, sound])).not.toThrow();
    // The final pass resolves the catalog placeholder to the user's uploaded asset.
    const uploaded = { ...sound, id: "saved-audio", variantGroupId: `builtin-audio:${entry.id}` };
    const executable = { ...action, parameters: { ...action.parameters, assetId: uploaded.id } };
    const after = executeAutonomousPlan(before, [executable], [asset, uploaded]);
    const cue = after.clips.find(c => c.id === action.id)!;
    expect(cue).toMatchObject({ start: 8, inPoint: 0.1, assetId: uploaded.id, volume: 0.15 });
    expect(cue.duration).toBeCloseTo(entry.duration - 0.1, 12);
    expect(cue.outPoint).toBeCloseTo(entry.duration, 12);
    expect(cue.start + cue.duration).toBeLessThan(original.end);
    expect(cue.speed).toBeUndefined();
    expect(after.duration).toBe(project.duration);
    expect(after.proposedChanges[0]).toEqual({ ...original, status: "accepted", reviewedAt: expect.any(String) });
    expect(action).toEqual(original);
    expect(executable.end).toBe(10);
    expect(before.proposedChanges[0]).toEqual(original);
    expect(auditAutomatedEdit(before, after, [asset, uploaded])).toEqual([]);
  });
  it("preserves a shorter requested sound interval and never extends a sound beyond its approved range", () => {
    const sound = { id: "sound", kind: "audio", duration: 1, status: "ready" } as Asset;
    const action = op("short-cue", "sound", 2.5, 2.7, { assetId: sound.id, sourceIn: 0.25 });
    const after = executeAutonomousPlan(project, [action], [asset, sound]);
    const cue = after.clips.find(c => c.id === action.id)!;
    expect(cue.start).toBe(action.start);
    expect(cue.duration).toBeCloseTo(0.2);
    expect(cue.inPoint).toBe(0.25);
    expect(cue.outPoint).toBeCloseTo(0.45);
    expect(cue.start + cue.duration).toBeLessThanOrEqual(action.end);
  });
  it("still rejects missing or invalid audio, empty source offsets and invalid timeline intervals", () => {
    const sound = { id: "sound", kind: "audio", duration: 0.6, status: "ready" } as Asset;
    const action = op("cue", "sound", 8, 10, { assetId: sound.id });
    for (const sourceIn of [-1, NaN, Infinity, 0.6, 1])
      expect(() => executeAutonomousPlan(project, [{ ...action, parameters: { ...action.parameters, sourceIn } }], [asset, sound])).toThrow(/sound placement/);
    for (const duration of [undefined, 0, -1, NaN, Infinity])
      expect(() => executeAutonomousPlan(project, [action], [asset, { ...sound, duration }])).toThrow(/sound placement/);
    for (const [start, end] of [[-1, 1], [NaN, 10], [8, Infinity], [8, 8], [8, 10.1]])
      expect(() => executeAutonomousPlan(project, [{ ...action, start, end }], [asset, sound])).toThrow(/sound placement/);
    expect(() => executeAutonomousPlan(project, [action], [asset])).toThrow(/sound placement/);
    expect(() => executeAutonomousPlan(project, [action], [asset, { ...sound, kind: "video" }])).toThrow(/sound placement/);
    expect(() => executeAutonomousPlan({ ...project, clips: project.clips.map(c => ({ ...c, locked: true })) }, [action], [asset, sound])).toThrow(/locked/);
    expect(project.clips).toHaveLength(1);
  });
  it("inserts the observed excerpt inside a supporting video and rejects overruns", () => {
    const excerpt = op("detail", "broll", 1, 3, {
      assetId: "source",
      sourceIn: 7,
    });
    const result = executeAutonomousPlan(project, [excerpt], [asset]);
    expect(result.clips.find(c => c.id === "detail")).toMatchObject({
      start: 1,
      duration: 2,
      inPoint: 7,
      outPoint: 9,
      muted: true,
    });
    for (const sourceIn of [9, -1, NaN])
      expect(() =>
        executeAutonomousPlan(
          project,
          [{ ...excerpt, parameters: { assetId: "source", sourceIn } }],
          [asset]
        )
      ).toThrow(/source interval/);
  });
  it("checks the whole draft including generation length without changing its signed operations", () => {
    const actions = [
      op("new", "broll", 0, 3, {
        prompt: "New shot",
        mediaKind: "video",
        sourceIn: 2,
      }),
    ];
    const saved = JSON.stringify(actions);
    expect(() =>
      preflightAutonomousPlan(project, actions, [asset])
    ).not.toThrow();
    expect(JSON.stringify(actions)).toBe(saved);
    expect(() =>
      preflightAutonomousPlan(project, [{ ...actions[0], end: 4 }], [asset])
    ).toThrow(/source interval/);
    expect(() =>
      preflightAutonomousPlan(
        project,
        [...actions, op("bad", "broll", 5, 6, { assetId: "missing" })],
        [asset]
      )
    ).toThrow(/bad/);
    expect(() =>
      preflightAutonomousPlan(project, [op("delete", "delete", 0, 10)], [asset])
    ).toThrow(/removed every clip/);
  });
  it("applies several local treatments to their original source pieces", () => {
    const result = executeAutonomousPlan(
      project,
      [
        op("opening", "style", 0, 2, { brightness: 0.1 }),
        op("middle", "style", 4, 6, { contrast: 1.2 }),
        op("level", "audio", 0, 2, { volume: 0.5 }),
      ],
      [asset]
    );
    const at = (time: number) =>
      result.clips.find(c => c.start <= time && c.start + c.duration > time)!;
    expect(at(1)).toMatchObject({ brightness: 0.1, volume: 0.5 });
    expect(at(3).brightness).toBeUndefined();
    expect(at(5).contrast).toBe(1.2);
    expect(at(8).contrast).toBeUndefined();
    expect(result.clips.reduce((n, c) => n + c.duration, 0)).toBe(10);
  });
  it("does not treat a pre-existing similarly named clip as a generated source piece", () => {
    const separate = {
      ...project.clips[0],
      id: "picture-user-copy",
      lane: 2,
      assetId: "other",
    };
    const result = executeAutonomousPlan(
      { ...project, clips: [...project.clips, separate] },
      [op("look", "style", 0, 2, { brightness: 0.1 })],
      [asset]
    );
    expect(result.clips.find(c => c.id === separate.id)).toEqual(separate);
  });
  it("removes every retained source piece when the original whole clip is deleted", () => {
    const result = executeAutonomousPlan(
      project,
      [
        op("look", "style", 4, 6, { brightness: 0.1 }),
        op("remove", "delete", 0, 10),
      ],
      [asset]
    );
    expect(result.clips).toEqual([]);
  });
  it("keeps the source project untouched when a later operation fails", () => {
    const saved = JSON.stringify(project);
    expect(() =>
      executeAutonomousPlan(
        project,
        [
          op("look", "style", 4, 6, { brightness: 0.1 }),
          op("missing", "broll", 0, 2, { assetId: "gone" }),
        ],
        [asset]
      )
    ).toThrow(/missing/);
    expect(JSON.stringify(project)).toBe(saved);
  });
  it("does not add a second layer of prepared captions", () => {
    const caption = {
      id: "speech",
      start: 1,
      end: 3,
      text: "These are the real words",
      sourceClipId: "picture",
    };
    const result = executeAutonomousPlan(
      { ...project, transcript: [caption] },
      [op("repeat", "caption", 1, 3, { text: caption.text })],
      [asset]
    );
    expect(result.transcript).toEqual([caption]);
    expect(() =>
      executeAutonomousPlan(
        { ...project, transcript: [caption] },
        [op("overlap", "caption", 2, 4, { text: "another layer" })],
        [asset]
      )
    ).toThrow(/overlap/);
  });
  it("rejects unavailable structural targets instead of trimming the wrong piece", () => {
    expect(() =>
      executeAutonomousPlan(
        project,
        [
          op("look", "style", 4, 6, { brightness: 0.1 }),
          op("trim", "trim", 0, 5, { sourceIn: 0 }),
        ],
        [asset]
      )
    ).toThrow(/explicit structural targets/);
  });
  it("cannot proceed past a cancellation checkpoint", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      executeAutonomousPlan(project, [op("look", "style", 0, 2)], [asset], () =>
        controller.signal.throwIfAborted()
      )
    ).toThrow();
  });
  it("rejects duplicate operation IDs and locked targets", () => {
    const action = op("one", "style", 0, 2, { brightness: 0.1 });
    expect(() =>
      executeAutonomousPlan(project, [action, action], [asset])
    ).toThrow(/repeats/);
    expect(() =>
      executeAutonomousPlan(
        { ...project, clips: project.clips.map(c => ({ ...c, locked: true })) },
        [action],
        [asset]
      )
    ).toThrow(/locked/);
  });
  it("checks all generated-media counts before any paid generation starts", () => {
    const actions = [
      op("one", "broll", 0, 2, { prompt: "A shot", mediaKind: "image" }),
      op("two", "broll", 2, 4, { prompt: "Another shot", mediaKind: "image" }),
    ];
    expect(() =>
      assertAutonomousMediaBudget(actions, { images: 1, videos: 0 })
    ).toThrow(/allowance/);
    expect(() =>
      assertAutonomousMediaBudget(actions, { images: 2, videos: 0 })
    ).not.toThrow();
    expect(() =>
      assertAutonomousMediaBudget(
        [op("ambiguous", "broll", 0, 2, { prompt: "A shot" })],
        { images: 1, videos: 1 }
      )
    ).toThrow(/type/);
  });
});
