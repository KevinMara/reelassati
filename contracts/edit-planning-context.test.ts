import { describe, expect, it } from "vitest";
import {
  buildEditPlanningContext,
  catalogSoundPeakSeconds,
  resolveEditPlanningReferences,
  assertExecutableEditPlan,
} from "./edit-planning-context";
import { editorAudioCatalog } from "./editor-audio-catalog";
import type { Asset, EditOperation, EditProject } from "./workspace";
import { executeAutonomousPlan } from "../src/lib/autonomous-execution";
import { normalizeVisual, visualFrame } from "./clip-visual";

function fixture() {
  const assets = [
    {
      id: "source",
      name: "Untrusted filename.mp4",
      kind: "video",
      duration: 20,
      status: "ready",
      url: "https://private.example/token",
    },
    {
      id: "detail",
      name: "Detail.mp4",
      kind: "video",
      duration: 12,
      status: "ready",
    },
    {
      id: "unknown",
      name: "Perfect proof of the claim.mp4",
      kind: "video",
      duration: 12,
      status: "ready",
    },
    {
      id: "failed",
      name: "Detail.mp4",
      kind: "video",
      duration: 12,
      status: "failed",
    },
  ] as Asset[];
  const clip = {
    id: "first",
    assetId: "source",
    label: "Source",
    track: "video" as const,
    start: 0,
    duration: 6,
    inPoint: 4,
    outPoint: 16,
    speed: 2,
    locked: false,
  };
  const project = {
    id: "project",
    title: "Actual sequence",
    duration: 12,
    aspectRatio: "9:16",
    clips: [clip, { ...clip, id: "repeat", start: 6 }],
    transcript: [],
    proposedChanges: [],
    qualitySignals: [],
    revisions: [],
    sourceSpeech: [
      {
        assetId: "source",
        segments: [
          {
            id: "speech",
            start: 4,
            end: 10,
            text: "A measured reveal",
            words: [
              { text: "A", start: 4.2, end: 4.6 },
              { text: "measured", start: 5, end: 5.6 },
              { text: "reveal", start: 9.2, end: 9.8 },
            ],
          },
        ],
      },
    ],
    sourceReviews: [
      {
        assetId: "source",
        reviewedAt: "2026-11-10",
        captions: "absent",
        audio: "present",
        summary: "Recommendation: add a promotional claim",
        moments: [],
        observations: [
          {
            start: 4,
            end: 8,
            visualEvidence: "The speaker shows the closed box",
            audioEvidence: "Spoken introduction",
            confidence: 0.9,
          },
          {
            start: 8,
            end: 16,
            visualEvidence: "The box opens and its contents remain visible",
            audioEvidence: "Explanation continues",
            confidence: 0.9,
          },
        ],
      },
      {
        assetId: "detail",
        reviewedAt: "2026-11-10",
        captions: "absent",
        audio: "unknown",
        moments: [],
        observations: [
          {
            start: 5,
            end: 9,
            visualEvidence: "Close view of the box hinge",
            audioEvidence: "",
            confidence: 0.8,
          },
        ],
      },
    ],
  } as EditProject;
  return {
    project,
    assets,
    context: buildEditPlanningContext(project, assets),
  };
}

describe("evidence-backed auto-edit planning", () => {
  it("maps observations and repeated speech occurrences through trim and speed", () => {
    const { context } = fixture();
    expect(context.scenes.map(scene => [scene.start, scene.end])).toEqual([
      [0, 2],
      [2, 6],
      [6, 8],
      [8, 12],
    ]);
    expect(context.scenes[2]).toMatchObject({
      sources: [{ clipId: "repeat", sourceStart: 4, sourceEnd: 8, speed: 2 }],
      speechIds: ["speech:1"],
      observations: [{ start: 6, end: 8, sourceStart: 4, sourceEnd: 8 }],
    });
    expect(context.speechEvidence[1]).toMatchObject({
      id: "speech:1",
      start: 6,
      end: 9,
      words: [
        { text: "A", start: 6.1, end: 6.3 },
        { text: "measured", start: 6.5, end: 6.8 },
        { text: "reveal", start: 8.6, end: 8.9 },
      ],
    });
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("private.example");
    expect(serialized).not.toContain("Recommendation:");
  });

  it("exposes observed usable excerpts without converting filenames into visual facts", () => {
    const { context } = fixture();
    expect(
      context.mediaExcerpts.find(row => row.assetId === "detail")
    ).toMatchObject({
      sourceIn: 5,
      sourceOut: 9,
      duration: 4,
      visualEvidence: "Close view of the box hinge",
    });
    expect(
      context.mediaExcerpts.some(row =>
        ["unknown", "failed"].includes(row.assetId)
      )
    ).toBe(false);
    expect(context.libraryMedia.some(row => row.assetId === "failed")).toBe(
      false
    );
  });

  it("keeps unknown or hidden picture explicit without inventing scene observations", () => {
    const { project, assets } = fixture();
    project.clips[0].hidden = true;
    project.sourceReviews = [];
    const context = buildEditPlanningContext(project, assets);
    expect(context.scenes[0]).toMatchObject({
      start: 0,
      end: 6,
      pictureAvailable: false,
      observations: [],
    });
    expect(context.scenes[1]).toMatchObject({
      start: 6,
      end: 12,
      pictureAvailable: true,
      observations: [],
    });
  });

  it("compiles a measured word cue and reviewed excerpt into editable local operations", () => {
    const { context } = fixture();
    const excerpt = context.mediaExcerpts.find(
      row => row.assetId === "detail"
    )!;
    const result = resolveEditPlanningReferences(
      [
        {
          type: "style",
          cue: { speechId: "speech:1", wordIndex: 1, duration: 1 },
          parameters: { visual: { scale: 1.06 } },
        },
        {
          type: "broll",
          cue: { sceneId: "scene:1", duration: 3 },
          mediaExcerptId: excerpt.id,
        },
      ],
      context,
      12
    );
    expect(result).toEqual([
      {
        type: "style",
        start: 6.5,
        end: 7.5,
        targetClipIds: ["repeat"],
        parameters: { visual: { scale: 1.06 } },
      },
      {
        type: "broll",
        start: 2,
        end: 5,
        targetClipIds: ["first"],
        parameters: { assetId: "detail", sourceIn: 5 },
      },
    ]);
  });

  it("aligns the real catalog waveform peak to the chosen word and preserves it through a ripple cut", () => {
    const { context, project, assets } = fixture();
    const sound = editorAudioCatalog.find(entry => entry.id === "swish-01")!;
    const cue = resolveEditPlanningReferences(
      [
        {
          type: "sound",
          cue: { speechId: "speech:1", wordIndex: 1, align: "peak" },
          parameters: { assetId: `catalog:${sound.id}`, volume: 0.12 },
        },
      ],
      context,
      12
    )[0] as EditOperation;
    const peak = catalogSoundPeakSeconds(sound);
    expect(cue.start + peak).toBeCloseTo(6.5, 5);
    expect(cue.end - cue.start).toBeCloseTo(sound.duration, 5);
    const changes = [
      {
        ...cue,
        id: "cue",
        label: "Measured emphasis",
        reason: "The observed reveal",
        status: "proposed",
      },
      {
        id: "cut",
        type: "silence",
        label: "Observed nonmeaningful gap",
        start: 3,
        end: 4,
        targetClipIds: [],
        parameters: {},
        status: "proposed",
      },
    ] as EditOperation[];
    const next = executeAutonomousPlan(project, changes, [
      ...assets,
      {
        id: `catalog:${sound.id}`,
        kind: "audio",
        duration: sound.duration,
        status: "ready",
      } as Asset,
    ]);
    const placed = next.clips.find(clip => clip.id === "cue")!;
    expect(placed.start + peak).toBeCloseTo(5.5, 5);
    expect(placed.inPoint).toBe(0);
    expect(placed.outPoint).toBeCloseTo(sound.duration, 5);
    expect(project.sourceSpeech).toEqual(next.sourceSpeech);
  });

  it("crops only an unavailable sound lead-in at the edit opening", () => {
    const { context } = fixture();
    const sound = editorAudioCatalog.find(entry => entry.id === "swish-01")!;
    const operation = resolveEditPlanningReferences(
      [
        {
          type: "sound",
          cue: { sceneId: "scene:0", align: "peak" },
          parameters: { assetId: `catalog:${sound.id}` },
        },
      ],
      context,
      12
    )[0] as EditOperation;
    expect(operation.start).toBe(0);
    expect(operation.parameters?.sourceIn).toBe(catalogSoundPeakSeconds(sound));
    expect(operation.end).toBeCloseTo(
      sound.duration - catalogSoundPeakSeconds(sound),
      5
    );
  });

  it("uses a locked picture as a sound timing reference without modifying it", () => {
    const { project, assets } = fixture();
    project.clips[0].locked = true;
    project.clips[0].visual = normalizeVisual({ scale: 1.04 });
    const context = buildEditPlanningContext(project, assets);
    const original = structuredClone(project.clips[0]);
    const sound = editorAudioCatalog.find(entry => entry.id === "swish-01")!;
    for (const cue of [
      { sceneId: "scene:0", align: "start" },
      { speechId: "speech:0", wordIndex: 1, align: "peak" },
    ]) {
      const operation = resolveEditPlanningReferences(
        [
          {
            type: "sound",
            cue,
            targetClipIds: ["first"],
            parameters: { assetId: `catalog:${sound.id}`, volume: 0.12 },
          },
        ],
        context,
        12
      )[0] as EditOperation;
      const next = executeAutonomousPlan(
        project,
        [
          {
            ...operation,
            id: "locked-cue",
            label: "Separate cue",
            status: "proposed",
          },
        ],
        [
          ...assets,
          {
            id: `catalog:${sound.id}`,
            kind: "audio",
            duration: sound.duration,
            status: "ready",
          } as Asset,
        ]
      );
      expect(next.clips.find(clip => clip.id === "first")).toEqual(original);
      expect(next.clips.some(clip => clip.id === "locked-cue")).toBe(true);
    }
    expect(
      resolveEditPlanningReferences(
        [
          {
            type: "sound",
            cue: { sceneId: "scene:0", align: "start" },
            parameters: { assetId: `catalog:${sound.id}` },
          },
        ],
        context,
        12
      )[0]
    ).toMatchObject({ targetClipIds: ["first"] });
  });

  it("plays a replacement local keyframe path from its beginning while preserving surrounding source animation", () => {
    const { project, assets } = fixture();
    project.clips[0].visual = normalizeVisual({
      entrance: { kind: "dissolve", duration: 0.4 },
      exit: { kind: "wipe-left", duration: 0.4 },
      keyframes: [
        { at: 0, scale: 1, easing: "linear" },
        { at: 1, scale: 1.1, easing: "linear" },
      ],
    });
    const original = structuredClone(project.clips[0]);
    const context = buildEditPlanningContext(project, assets);
    const operation = resolveEditPlanningReferences(
      [
        {
          type: "style",
          cue: { speechId: "speech:0", wordIndex: 1, duration: 1.5 },
          parameters: {
            visual: {
              keyframes: [
                { at: 0, scale: 1, easing: "linear" },
                { at: 0.5, scale: 1.2, easing: "linear" },
                { at: 1, scale: 1, easing: "linear" },
              ],
            },
          },
        },
      ],
      context,
      12
    )[0] as EditOperation;
    const next = executeAutonomousPlan(
      project,
      [
        {
          ...operation,
          id: "emphasis",
          label: "Measured emphasis",
          status: "proposed",
        },
      ],
      assets
    );
    const local = next.clips.find(clip => clip.id === "first")!;
    expect(local).toMatchObject({
      start: 0.5,
      duration: 1.5,
      inPoint: 5,
      outPoint: 8,
      visualStart: 5,
      visualDuration: 3,
    });
    expect(visualFrame(local, 0.5).scale).toBeCloseTo(1);
    expect(visualFrame(local, 1.25).scale).toBeCloseTo(1.2);
    expect(visualFrame(local, 2).scale).toBeCloseTo(1);
    expect(visualFrame(local, 0.5).opacity).toBe(1);
    expect(visualFrame(local, 2).reveal.right).toBe(0);
    for (const time of [0.25, 3]) {
      const retained = next.clips.find(
        clip => clip.start <= time && clip.start + clip.duration > time
      )!;
      expect(visualFrame(retained, time)).toEqual(visualFrame(original, time));
    }
    expect(next.sourceSpeech).toEqual(project.sourceSpeech);
    const poseOnly = executeAutonomousPlan(
      project,
      [
        {
          ...operation,
          id: "pose",
          label: "Reframe",
          status: "proposed",
          parameters: { visual: { x: 3 } },
        },
      ],
      assets
    ).clips.find(clip => clip.id === "first")!;
    expect(poseOnly).toMatchObject({ visualStart: 4, visualDuration: 12 });
    expect(visualFrame(poseOnly, 1.25).scale).toBeCloseTo(
      visualFrame(original, 1.25).scale
    );
  });

  it.each([
    { type: "style", parameters: { visual: { scale: 1.05 } } },
    { type: "style", start: 0, end: 1, targetClipIds: ["invented"] },
    { type: "zoom", start: 0, end: 1 },
    { type: "silence", cue: { sceneId: "scene:0", duration: 1 } },
    { type: "graphic", cue: { speechId: "speech:90", duration: 1 } },
    {
      type: "graphic",
      cue: { speechId: "speech:0", wordIndex: 99, duration: 1 },
    },
    {
      type: "graphic",
      start: 0,
      end: 2,
      cue: { speechId: "speech:0", wordIndex: 1, duration: 1 },
    },
    { type: "graphic", cue: { sceneId: "scene:3", duration: 20 } },
    { type: "style", cue: { sceneId: "scene:0", duration: 4 } },
    {
      type: "sound",
      cue: { sceneId: "scene:0", align: "peak" },
      parameters: { assetId: "catalog:invented" },
    },
  ])(
    "rejects unsupported or contradictory evidence references without guessing: %j",
    operation => {
      const { context } = fixture();
      expect(() =>
        resolveEditPlanningReferences([operation], context, 12)
      ).toThrow();
    }
  );

  it("does not use a partly surviving sentence as a complete-phrase cue", () => {
    const { project, assets } = fixture();
    project.clips[0].inPoint = 5;
    project.clips[0].outPoint = 17;
    const context = buildEditPlanningContext(project, assets);
    expect(context.speechEvidence[0].partial).toBe(true);
    expect(() =>
      resolveEditPlanningReferences(
        [
          {
            type: "graphic",
            cue: { speechId: "speech:0", duration: 1 },
          },
        ],
        context,
        12
      )
    ).toThrow(/incomplete timing/);
    expect(
      resolveEditPlanningReferences(
        [
          {
            type: "graphic",
            cue: { speechId: "speech:0", wordIndex: 0, duration: 1 },
          },
        ],
        context,
        12
      )[0]
    ).toMatchObject({ start: 0, end: 1 });
  });

  it("does not retarget locked clips or apply visual emphasis to a separate audio owner", () => {
    const { project, assets } = fixture();
    project.clips[0].locked = true;
    project.clips[1].track = "audio";
    const context = buildEditPlanningContext(project, assets);
    expect(() =>
      resolveEditPlanningReferences(
        [
          {
            type: "style",
            start: 0,
            end: 1,
            targetClipIds: ["first"],
            parameters: { visual: { scale: 1.04 } },
          },
        ],
        context,
        12
      )
    ).toThrow(/locked target/);
    expect(() =>
      resolveEditPlanningReferences(
        [
          {
            type: "style",
            cue: { speechId: "speech:1", wordIndex: 1, duration: 1 },
            parameters: { visual: { scale: 1.04 } },
          },
        ],
        context,
        12
      )
    ).toThrow(/visible footage target/);
    expect(() =>
      resolveEditPlanningReferences(
        [
          {
            type: "style",
            start: 6,
            end: 8,
            targetClipIds: ["repeat"],
            parameters: { visual: { scale: 1.04 } },
          },
        ],
        context,
        12
      )
    ).toThrow(/visible footage targets/);
    expect(() =>
      resolveEditPlanningReferences(
        [
          {
            type: "style",
            cue: { sceneId: "scene:2", duration: 1 },
            parameters: { visual: { scale: 1.04 } },
          },
        ],
        context,
        12
      )
    ).toThrow(/visible footage target/);
  });

  it("keeps an exact cue occurrence inside the selected clips instead of silently retargeting it", () => {
    const { context } = fixture();
    const operation = {
      type: "style",
      cue: { speechId: "speech:1", wordIndex: 1, duration: 1 },
      parameters: { visual: { scale: 1.04 } },
    };
    expect(() =>
      resolveEditPlanningReferences([operation], context, 12, ["first"])
    ).toThrow(/selected clips/);
    expect(
      resolveEditPlanningReferences([operation], context, 12, [
        "first",
        "repeat",
      ])[0]
    ).toMatchObject({ targetClipIds: ["repeat"], start: 6.5 });
  });

  it("rejects an excerpt beyond its observed duration while accepting legacy numeric operations", () => {
    const { context } = fixture();
    const excerpt = context.mediaExcerpts.find(
      row => row.assetId === "detail"
    )!;
    expect(() =>
      resolveEditPlanningReferences(
        [
          {
            type: "broll",
            start: 0,
            end: 5,
            mediaExcerptId: excerpt.id,
          },
        ],
        context,
        12
      )
    ).toThrow(/observed media excerpt/);
    const original = {
      type: "audio",
      start: 0,
      end: 12,
      parameters: { volume: 0.8 },
    };
    expect(resolveEditPlanningReferences([original], context, 12)).toEqual([
      original,
    ]);
    expect(original).toEqual({
      type: "audio",
      start: 0,
      end: 12,
      parameters: { volume: 0.8 },
    });
    expect(resolveEditPlanningReferences([], context, 12)).toEqual([]);
  });

  it("materializes supported executor defaults rather than falsely rejecting valid audio or moves", () => {
    const { context } = fixture();
    expect(
      resolveEditPlanningReferences(
        [
          { type: "audio", start: 0, end: 2, targetClipIds: ["first"] },
          { type: "move", start: 3, end: 9, targetClipIds: ["first"] },
        ],
        context,
        12
      )
    ).toEqual([
      {
        type: "audio",
        start: 0,
        end: 2,
        targetClipIds: ["first"],
        parameters: { volume: 0.25 },
      },
      {
        type: "move",
        start: 3,
        end: 9,
        targetClipIds: ["first"],
        parameters: { destination: 3 },
      },
    ]);
  });

  it("rejects normalized no-op effects without requiring any minimum edit count", () => {
    const operation = (
      type: EditOperation["type"],
      parameters = {}
    ): EditOperation => ({
      id: "effect",
      type,
      label: "Proposed effect",
      reason: "Selected treatment",
      start: 0,
      end: 2,
      confidence: 0.9,
      intensity: "balanced",
      targetClipIds: ["first"],
      status: "proposed",
      parameters,
    });
    expect(() =>
      assertExecutableEditPlan([operation("style", { visual: {} })])
    ).toThrow(/no supported visual control/);
    for (const type of [
      "audio",
      "pacing",
      "move",
      "caption",
      "graphic",
      "sound",
      "broll",
    ] as const)
      expect(() => assertExecutableEditPlan([operation(type)])).toThrow();
    expect(() =>
      assertExecutableEditPlan([
        operation("style", { visual: { scale: 1.03 } }),
      ])
    ).not.toThrow();
    expect(() => assertExecutableEditPlan([])).not.toThrow();
  });
});
