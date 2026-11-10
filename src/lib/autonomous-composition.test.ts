import { describe, expect, it, vi } from "vitest";
import type { Asset, EditOperation, EditProject } from "@contracts/workspace";
import {
  assertAutonomousComposition,
  orderAutonomousOperations,
} from "@contracts/autonomous-operation-order";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { normalizeVisual } from "@contracts/clip-visual";
import {
  buildEditPlanningContext,
  resolveEditPlanningReferences,
} from "@contracts/edit-planning-context";
import {
  executeAutonomousPlan,
  preflightAutonomousPlan,
} from "./autonomous-execution";

const operation = (
  id: string,
  type: EditOperation["type"],
  start: number,
  end: number,
  parameters: EditOperation["parameters"] = {},
  targetClipIds = ["first"]
): EditOperation => ({
  id,
  type,
  start,
  end,
  parameters,
  targetClipIds,
  label: id,
  reason: "Measured source treatment",
  confidence: 1,
  intensity: "balanced",
  status: "proposed",
});

function fixture(repeated = false) {
  const first = {
    id: "first",
    assetId: "source",
    track: "video" as const,
    label: "Source",
    start: 0,
    duration: 10,
    inPoint: 0,
    outPoint: 10,
    locked: false,
  };
  const transcript = {
    id: "caption",
    sourceClipId: "first",
    start: 4.2,
    end: 4.7,
    text: "Measured words",
    words: [
      { text: "Measured", start: 4.2, end: 4.4 },
      { text: "words", start: 4.5, end: 4.7 },
    ],
  };
  const project = {
    id: "project",
    duration: repeated ? 22 : 10,
    aspectRatio: "9:16",
    playhead: 0,
    clips: [
      first,
      ...(repeated ? [{ ...first, id: "repeat", start: 12 }] : []),
    ],
    transcript: [
      transcript,
      ...(repeated
        ? [
            {
              ...transcript,
              id: "repeat-caption",
              sourceClipId: "repeat",
              start: 16.2,
              end: 16.7,
              words: transcript.words.map(word => ({
                ...word,
                start: word.start + 12,
                end: word.end + 12,
              })),
            },
          ]
        : []),
    ],
    sourceSpeech: [
      {
        assetId: "source",
        segments: [{ ...transcript, sourceClipId: undefined }],
      },
    ],
    proposedChanges: [],
    revisions: [],
    qualitySignals: [],
  } as unknown as EditProject;
  const assets = [
    { id: "source", kind: "video", duration: 20, status: "ready" },
    { id: "support", kind: "video", duration: 20, status: "ready" },
    { id: "cue", kind: "audio", duration: 0.4, status: "ready" },
  ] as Asset[];
  return { project, assets };
}

describe("retained trims composed with local auto-edit treatments", () => {
  it("applies a rounded global grade and mix over the entire retained fractional source without changing speech", () => {
    const { project, assets } = fixture();
    project.duration = 28.350708;
    project.clips[0] = {
      ...project.clips[0],
      duration: project.duration,
      outPoint: project.duration,
    };
    assets[0].duration = project.duration;
    const original = structuredClone(project);
    const result = executeAutonomousPlan(
      project,
      [
        operation("look", "style", 0, 28, { contrast: 1.1 }),
        operation("mix", "audio", 0, 28, { volume: 0.8 }),
        operation("trim", "trim", 0, 25, { sourceIn: 0 }),
      ],
      assets
    );
    expect(result.clips).toHaveLength(1);
    expect(result.clips[0]).toMatchObject({
      start: 0,
      duration: 25,
      inPoint: 0,
      outPoint: 25,
      contrast: 1.1,
      volume: 0.8,
    });
    expect(result.transcript).toEqual(original.transcript);
    expect(result.sourceSpeech).toEqual(original.sourceSpeech);
    expect(project).toEqual(original);
  });

  it.each([
    operation("animated", "style", 0, 28, {
      visual: normalizeVisual({
        keyframes: [
          { at: 0, scale: 1 },
          { at: 1, scale: 1.1 },
        ],
      }),
    }),
    operation("local", "style", 24, 28, { contrast: 1.1 }),
    operation("fade", "style", 0, 28, { fadeOut: 1 }),
  ])(
    "does not compress a timed treatment that crosses the removed tail: $id",
    treatment => {
      const { project } = fixture();
      project.duration = 28.350708;
      project.clips[0] = {
        ...project.clips[0],
        duration: project.duration,
        outPoint: project.duration,
      };
      expect(() =>
        assertAutonomousComposition(project, [
          operation("trim", "trim", 0, 25, { sourceIn: 0 }),
          treatment,
        ])
      ).toThrow(
        expect.objectContaining({
          reason: "retained_range_conflict",
          operationIndex: 1,
          operationType: "style",
        })
      );
    }
  );

  it("compiles and executes explicit linked AV peers together while rejecting arbitrary or malformed audio targets", () => {
    const { project, assets } = fixture();
    project.clips[0] = {
      ...project.clips[0],
      linkId: "explicit-av",
      muted: true,
    };
    project.clips.push({
      ...project.clips[0],
      id: "voice",
      track: "audio",
      muted: false,
    });
    project.transcript = project.transcript.map(segment => ({
      ...segment,
      sourceClipId: "voice",
    }));
    const original = structuredClone(project);
    const targets = ["first", "voice"];
    const context = buildEditPlanningContext(project, assets);
    const raw = operation("look", "style", 4, 6, { contrast: 1.1 }, targets);
    const compiled = resolveEditPlanningReferences(
      [raw],
      context,
      10
    ) as EditOperation[];
    const result = executeAutonomousPlan(
      project,
      [operation("trim", "trim", 0, 9, { sourceIn: 0 }, targets), ...compiled],
      assets
    );
    const picture = result.clips.find(clip => clip.id === "first")!;
    const audio = result.clips.find(clip => clip.id === "voice")!;
    expect(picture).toMatchObject({
      start: 4,
      duration: 2,
      inPoint: 4,
      outPoint: 6,
      contrast: 1.1,
    });
    expect(audio).toMatchObject({
      start: 4,
      duration: 2,
      inPoint: 4,
      outPoint: 6,
      linkId: picture.linkId,
    });
    expect(audio.linkId).toBeTruthy();
    expect(result.transcript).toEqual(original.transcript);
    expect(result.sourceSpeech).toEqual(original.sourceSpeech);
    expect(project).toEqual(original);
    expect(() =>
      assertAutonomousComposition(project, [
        { ...raw, targetClipIds: ["first"] },
      ])
    ).toThrow(/Include linked audio/);
    expect(() =>
      resolveEditPlanningReferences(
        [{ ...raw, targetClipIds: ["voice"] }],
        context,
        10
      )
    ).toThrow(/visible footage/);
    project.clips[1].duration = 9;
    project.clips[1].outPoint = 9;
    expect(() =>
      resolveEditPlanningReferences(
        [raw],
        buildEditPlanningContext(project, assets),
        10
      )
    ).toThrow(/visible footage/);
  });
  it.each([false, true])(
    "composes trim0..9 with style4..6 and sound without altering a repeated occurrence (%s)",
    repeated => {
      const { project, assets } = fixture(repeated);
      const original = structuredClone(project);
      const changes = [
        operation("look", "style", 4, 6, { contrast: 1.2 }),
        operation("trim", "trim", 0, 9, { sourceIn: 0 }),
        operation("cue", "sound", 4.3, 4.7, { assetId: "cue", volume: 0.12 }),
        operation("mix", "audio", 4, 6, { volume: 0.8 }),
      ];
      expect(
        orderAutonomousOperations(project, changes).map(op => op.id)
      ).toEqual(["cue", "trim", "look", "mix"]);
      const result = executeAutonomousPlan(project, changes, assets);
      expect(result.clips.find(clip => clip.id === "first")).toMatchObject({
        start: 4,
        duration: 2,
        inPoint: 4,
        outPoint: 6,
        contrast: 1.2,
        volume: 0.8,
      });
      expect(
        result.clips
          .filter(clip => clip.assetId === "source" && clip.start < 10)
          .reduce((total, clip) => total + clip.duration, 0)
      ).toBe(9);
      expect(result.clips.find(clip => clip.id === "cue")).toMatchObject({
        start: 4.3,
        inPoint: 0,
      });
      expect(result.transcript).toEqual(original.transcript);
      expect(result.sourceSpeech).toEqual(original.sourceSpeech);
      expect(result.duration).toBe(repeated ? 22 : 9);
      if (repeated)
        expect(result.clips.find(clip => clip.id === "repeat")).toEqual(
          original.clips[1]
        );
      expect(project).toEqual(original);
      expect(() =>
        preflightAutonomousPlan(project, changes, assets)
      ).not.toThrow();
    }
  );

  it("maps a retained trim correctly through nonzero source offsets and playback speed", () => {
    const { project, assets } = fixture();
    project.duration = 13;
    project.clips[0] = {
      ...project.clips[0],
      start: 3,
      inPoint: 4,
      outPoint: 24,
      speed: 2,
    };
    project.transcript = [];
    assets[0].duration = 30;
    const result = executeAutonomousPlan(
      project,
      [
        operation("look", "style", 6, 7, { brightness: 0.1 }),
        operation("trim", "trim", 4, 12, { sourceIn: 6 }),
      ],
      assets
    );
    expect(result.clips.find(clip => clip.id === "first")).toMatchObject({
      start: 6,
      duration: 1,
      inPoint: 10,
      outPoint: 12,
      speed: 2,
      brightness: 0.1,
    });
    expect(result.duration).toBe(12);
  });

  it("retains an explicit graphic outro after source trimming instead of shrinking its canvas first", () => {
    const { project, assets } = fixture();
    const result = executeAutonomousPlan(
      project,
      [
        operation("trim", "trim", 0, 9, { sourceIn: 0 }),
        operation("look", "style", 4, 6, { contrast: 1.1 }),
        operation("outro", "graphic", 9, 10, {
          graphic: normalizeGraphic({
            kind: "rectangle",
            x: 50,
            y: 50,
            width: 90,
            height: 40,
          }),
        }),
      ],
      assets
    );
    expect(result.duration).toBe(10);
    expect(result.clips.find(clip => clip.id === "outro")).toMatchObject({
      start: 9,
      duration: 1,
    });
    expect(
      Math.max(
        ...result.clips
          .filter(clip => clip.assetId === "source")
          .map(clip => clip.outPoint)
      )
    ).toBe(9);
  });

  it("keeps inserted supporting-media samples and sound aligned through a retained trim and ripple cut", () => {
    const { project, assets } = fixture();
    const changes = [
      operation("trim", "trim", 0, 9, { sourceIn: 0 }),
      operation("look", "style", 4, 6, { contrast: 1.1 }),
      operation("cut", "silence", 3, 4),
      operation("coverage", "broll", 2, 7, { assetId: "support", sourceIn: 5 }),
      operation("cue", "sound", 4.3, 4.7, { assetId: "cue", volume: 0.12 }),
    ];
    const result = executeAutonomousPlan(project, changes, assets);
    expect(
      result.clips
        .filter(clip => clip.assetId === "support")
        .map(clip => ({
          start: clip.start,
          duration: clip.duration,
          inPoint: clip.inPoint,
          outPoint: clip.outPoint,
        }))
    ).toEqual([
      { start: 2, duration: 1, inPoint: 5, outPoint: 6 },
      { start: 3, duration: 3, inPoint: 7, outPoint: 10 },
    ]);
    expect(result.clips.find(clip => clip.id === "cue")?.start).toBeCloseTo(
      3.3
    );
    expect(result.transcript[0].start).toBeCloseTo(3.2);
    expect(result.transcript[0].words?.[1].start).toBeCloseTo(3.5);
    expect(result.duration).toBe(8);
    expect(result.sourceSpeech).toEqual(project.sourceSpeech);
    expect(() =>
      preflightAutonomousPlan(project, changes, assets)
    ).not.toThrow();
  });

  it("adapts a whole-clip grade to the retained source but rejects a partly removed local treatment before execution", () => {
    const { project, assets } = fixture();
    expect(() =>
      executeAutonomousPlan(
        project,
        [
          operation("trim", "trim", 0, 9, { sourceIn: 0 }),
          operation("grade", "style", 0, 10, { contrast: 1.1 }),
        ],
        assets
      )
    ).not.toThrow();
    const onStep = vi.fn();
    expect(() =>
      executeAutonomousPlan(
        project,
        [
          operation("trim", "trim", 0, 9, { sourceIn: 0 }),
          operation("beat", "style", 8, 10, { contrast: 1.1 }),
        ],
        assets,
        undefined,
        onStep
      )
    ).toThrow(/explicit structural targets/);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("rejects redundant structural operations before local splitting instead of crashing after partial execution", () => {
    const { project, assets } = fixture();
    for (const structural of [
      operation("same-speed", "pacing", 0, 10, { speed: 1 }),
      operation("same-position", "move", 0, 10, { destination: 0 }),
    ]) {
      const onStep = vi.fn();
      expect(() =>
        executeAutonomousPlan(
          project,
          [structural, operation("look", "style", 4, 6, { contrast: 1.1 })],
          assets,
          undefined,
          onStep
        )
      ).toThrow(/redundant/);
      expect(onStep).not.toHaveBeenCalled();
    }
  });

  it.each(["trim", "move", "pacing"] as const)(
    "rejects ambiguous %s clock changes with dependent treatments or sounds before execution",
    type => {
      const { project, assets } = fixture();
      const structural = operation(
        "structure",
        type,
        0,
        9,
        type === "trim"
          ? { sourceIn: 1 }
          : type === "move"
            ? { destination: 1 }
            : { speed: 1.2 }
      );
      for (const dependent of [
        operation("look", "style", 4, 6, { contrast: 1.1 }),
        operation("cue", "sound", 4.3, 4.7, { assetId: "cue" }),
      ]) {
        expect(() =>
          assertAutonomousComposition(project, [structural, dependent])
        ).toThrow(/resulting timeline/);
        const onStep = vi.fn();
        expect(() =>
          executeAutonomousPlan(
            project,
            [structural, dependent],
            assets,
            undefined,
            onStep
          )
        ).toThrow();
        expect(onStep).not.toHaveBeenCalled();
      }
      expect(() =>
        executeAutonomousPlan(project, [structural], assets)
      ).not.toThrow();
    }
  );
});
