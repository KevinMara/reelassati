import { describe, expect, it } from "vitest";
import type { Asset, EditOperation, EditProject } from "@contracts/workspace";
import { editorAudioCatalog } from "@contracts/editor-audio-catalog";
import { normalizeGraphic } from "@contracts/motion-graphics";
import {
  AI_COMPLIANCE_POLICY_VERSION,
  AI_PROVENANCE_SCHEME,
} from "@contracts/compliance";
import { auditAutomatedEdit } from "./editor-production";
import { autonomousResultReceipt } from "./autonomous-result-receipt";
import {
  assertAutonomousMediaBudget,
  autonomousGraphicReceipt,
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
  it("omits invalid automatic sound cues, retains valid edits, and reports the omission without altering proposals", () => {
    const sound = {
      ...asset,
      id: "cue",
      kind: "audio",
      duration: 0.3,
    } as Asset;
    const actions = [
      op("missing", "sound", 1, 2, { assetId: "catalog:invented" }),
      op("bad-offset", "sound", 2, 3, { assetId: sound.id, sourceIn: 2 }),
      op("valid-cue", "sound", 4, 5, { assetId: sound.id }),
      op("grade", "style", 0, 10, { saturation: 0.95 }),
    ];
    const original = structuredClone(actions);
    const review = preflightAutonomousPlan(
      project,
      actions,
      [asset, sound],
      undefined,
      "automatic"
    );
    expect(review.changes.map(action => action.id)).toEqual([
      "valid-cue",
      "grade",
    ]);
    expect(review.omittedSounds?.map(item => item.operationId)).toEqual([
      "missing",
      "bad-offset",
    ]);
    expect(autonomousGraphicReceipt(review)).toBe(
      "Skipped 2 unavailable sound cues."
    );
    const after = executeAutonomousPlan(project, review.changes, [
      asset,
      sound,
    ]);
    expect(after.clips.find(clip => clip.assetId === sound.id)).toMatchObject({
      start: 4,
      inPoint: 0,
    });
    expect(
      after.clips.find(clip => clip.assetId === sound.id)?.duration
    ).toBeCloseTo(0.3);
    expect(actions).toEqual(original);
    expect(() =>
      preflightAutonomousPlan(project, actions, [asset, sound])
    ).toThrow(/sound placement/);
  });

  it("still rejects destructive picture changes after omitting an invalid cue", () => {
    expect(() =>
      preflightAutonomousPlan(
        project,
        [
          op("missing", "sound", 1, 2, { assetId: "missing" }),
          op("remove-picture", "delete", 0, 10),
        ],
        [asset],
        undefined,
        "automatic"
      )
    ).toThrow(/removed all visible picture content/);
  });
  it.each([false, true])(
    "rejects deleting the last visible picture even with staged sound and hidden footage=%s",
    hiddenFootage => {
      const music = { ...asset, id: "music", kind: "audio" } as Asset;
      const before = {
        ...project,
        clips: [
          ...project.clips,
          ...(hiddenFootage
            ? [{ ...project.clips[0], id: "hidden-picture", hidden: true }]
            : []),
        ],
      };
      const actions = [
        op("bed", "sound", 0, 10, { assetId: music.id }),
        op("delete", "delete", 9, 10),
      ];
      const original = structuredClone({ before, actions });
      expect(() =>
        preflightAutonomousPlan(before, actions, [asset, music])
      ).toThrow(/removed all visible picture content/);
      const after = executeAutonomousPlan(before, actions, [asset, music]);
      expect(after.clips.some(c => c.assetId === music.id)).toBe(true);
      expect(after.clips.some(c => c.id === "picture")).toBe(false);
      expect(auditAutomatedEdit(before, after, [asset, music])).toContain(
        "The edit removed all visible picture content"
      );
      expect({ before, actions }).toEqual(original);
    }
  );

  it.each(["video", "image", "export"] as const)(
    "allows replacing all original footage with a %s and a new sound bed",
    kind => {
      const music = { ...asset, id: "music", kind: "audio" } as Asset;
      const replacement = { ...asset, id: "replacement", kind };
      const assets = [asset, music, replacement];
      const actions = [
        op("bed", "sound", 0, 10, { assetId: music.id }),
        op("delete", "delete", 9, 10),
        op("replacement", "broll", 0, 2, { assetId: replacement.id }),
      ];
      expect(() =>
        preflightAutonomousPlan(project, actions, assets)
      ).not.toThrow();
      const after = executeAutonomousPlan(project, actions, assets);
      expect(after.clips.some(c => c.id === "picture")).toBe(false);
      expect(after.clips.some(c => c.assetId === replacement.id)).toBe(true);
      expect(auditAutomatedEdit(project, after, assets)).toEqual([]);
    }
  );

  it("allows replacement graphics and preserves pre-existing audio-only edits", () => {
    const music = { ...asset, id: "music", kind: "audio" } as Asset;
    const actions = [
      op("bed", "sound", 0, 10, { assetId: music.id }),
      op("delete", "delete", 9, 10),
    ];
    const graphicActions = [
      ...actions,
      op("title", "graphic", 0, 2, {
        graphic: normalizeGraphic({ kind: "text", text: "Replacement title" }),
      }),
    ];
    expect(() =>
      preflightAutonomousPlan(project, graphicActions, [asset, music])
    ).not.toThrow();
    const graphical = executeAutonomousPlan(project, graphicActions, [
      asset,
      music,
    ]);
    expect(graphical.clips.some(c => c.graphic)).toBe(true);
    expect(auditAutomatedEdit(project, graphical, [asset, music])).toEqual([]);

    const audioOnly = {
      ...project,
      clips: [
        { ...project.clips[0], assetId: music.id, track: "audio" as const },
      ],
    };
    expect(() =>
      preflightAutonomousPlan(audioOnly, actions, [music])
    ).not.toThrow();
    const audioResult = executeAutonomousPlan(audioOnly, actions, [music]);
    expect(audioResult.clips).toHaveLength(1);
    expect(audioResult.clips[0].track).toBe("audio");
    expect(auditAutomatedEdit(audioOnly, audioResult, [music])).toEqual([]);
  });

  it("keeps a whole-edit music bed on the shortened clock without extending the K3 footage ending", () => {
    const duration = 28.350708;
    const source = { ...asset, duration };
    const music = {
      id: "music",
      kind: "audio",
      duration: 123.193469,
      status: "ready",
    } as Asset;
    const bed = op("bed", "sound", 0, 28.35, {
      assetId: music.id,
      volume: 0.15,
    });
    const cut = op("gap", "silence", 24.4, 25);
    const original = structuredClone([bed, cut]);
    const before = {
      ...project,
      duration,
      clips: [{ ...project.clips[0], duration, outPoint: duration }],
      proposedChanges: [bed, cut],
    };
    expect(() =>
      preflightAutonomousPlan(before, [cut, bed], [source, music])
    ).not.toThrow();
    const after = executeAutonomousPlan(before, [cut, bed], [source, music]);
    const pictureEnd = Math.max(
      ...after.clips
        .filter(c => c.track === "video")
        .map(c => c.start + c.duration)
    );
    const musicEnd = Math.max(
      ...after.clips
        .filter(c => c.assetId === music.id)
        .map(c => c.start + c.duration)
    );
    expect(pictureEnd).toBeCloseTo(27.750708, 9);
    expect(musicEnd).toBeCloseTo(27.75, 9);
    expect(after.duration).toBeCloseTo(pictureEnd, 9);
    expect(after.proposedChanges.find(c => c.id === bed.id)).toEqual({
      ...original[0],
      status: "accepted",
      reviewedAt: expect.any(String),
    });
    expect([bed, cut]).toEqual(original);
    expect(before.clips).toHaveLength(1);
    expect(auditAutomatedEdit(before, after, [source, music])).toEqual([]);
  });

  it("preserves the surviving source samples and endpoint fades when a sound spans a removed interval", () => {
    const music = {
      id: "music",
      kind: "audio",
      duration: 20,
      status: "ready",
    } as Asset;
    const bed = op("bed", "sound", 0, 10, {
      assetId: music.id,
      sourceIn: 5,
      fadeIn: 0.2,
      fadeOut: 0.4,
    });
    const after = executeAutonomousPlan(
      project,
      [op("gap", "silence", 4, 6), bed],
      [asset, music]
    );
    const pieces = after.clips
      .filter(c => c.assetId === music.id)
      .sort((a, b) => a.start - b.start);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toMatchObject({
      start: 0,
      duration: 4,
      inPoint: 5,
      outPoint: 9,
      fadeIn: 0.2,
      fadeOut: 0,
    });
    expect(pieces[1]).toMatchObject({
      start: 4,
      duration: 4,
      inPoint: 11,
      outPoint: 15,
      fadeIn: 0,
      fadeOut: 0.4,
    });
    expect(after.duration).toBe(8);
    expect(pieces.every(c => c.outPoint <= music.duration!)).toBe(true);
  });

  it.each([
    ["bed", "early", "late"],
    ["bed", "late", "early"],
    ["early", "bed", "late"],
    ["early", "late", "bed"],
    ["late", "early", "bed"],
    ["late", "bed", "early"],
  ])(
    "maps several disjoint cuts independently of proposal order %j",
    (...ids) => {
      const music = {
        id: "music",
        kind: "audio",
        duration: 20,
        status: "ready",
      } as Asset;
      const operations = {
        bed: op("bed", "sound", 0, 10, { assetId: music.id, sourceIn: 2 }),
        early: op("early", "silence", 2, 3),
        late: op("late", "silence", 7, 8),
      };
      const after = executeAutonomousPlan(
        project,
        ids.map(id => operations[id as keyof typeof operations]),
        [asset, music]
      );
      expect(
        after.clips
          .filter(c => c.assetId === music.id)
          .sort((a, b) => a.start - b.start)
          .map(c => [c.start, c.duration, c.inPoint, c.outPoint])
      ).toEqual([
        [0, 2, 2, 4],
        [2, 4, 5, 9],
        [6, 2, 10, 12],
      ]);
      expect(after.duration).toBe(8);
    }
  );

  it.each([true, false])(
    "handles equal-start sound/cut ordering and interval boundaries (sound first: %s)",
    soundFirst => {
      const sound = {
        id: "sound",
        kind: "audio",
        duration: 20,
        status: "ready",
      } as Asset;
      const cue = op("cue", "sound", 4, 6, { assetId: sound.id, sourceIn: 3 });
      const cut = op("gap", "silence", 4, 5);
      const actions = [
        ...(soundFirst ? [cue, cut] : [cut, cue]),
        op("inside", "sound", 4, 4.1, { assetId: sound.id }),
        op("inside-later", "sound", 4.25, 4.26, { assetId: sound.id }),
        op("before", "sound", 3.9, 4, { assetId: sound.id, sourceIn: 2 }),
        op("after", "sound", 5, 5.1, { assetId: sound.id, sourceIn: 7 }),
      ];
      const after = executeAutonomousPlan(
        { ...project, proposedChanges: structuredClone(actions) },
        actions,
        [asset, sound]
      );
      expect(after.clips.find(c => c.id.startsWith("cue"))).toMatchObject({
        start: 4,
        duration: 1,
        inPoint: 4,
        outPoint: 5,
      });
      expect(after.clips.some(c => c.id.startsWith("inside"))).toBe(false);
      const before = after.clips.find(c => c.id === "before")!;
      expect(before.start).toBe(3.9);
      expect(before.start + before.duration).toBe(4);
      expect(before.inPoint).toBe(2);
      const following = after.clips.find(c => c.id === "after")!;
      expect(following.start).toBe(4);
      expect(following.duration).toBeCloseTo(0.1);
      expect(following.inPoint).toBe(7);
      expect(after.proposedChanges.find(c => c.id === "inside")?.status).toBe(
        "accepted"
      );
      expect(after.clips.every(c => c.duration > 0)).toBe(true);
    }
  );

  it("caps source duration before projecting a partially removed short cue", () => {
    const sound = {
      id: "sound",
      kind: "audio",
      duration: 2.5,
      status: "ready",
    } as Asset;
    const cue = op("cue", "sound", 3, 8, { assetId: sound.id, sourceIn: 1 });
    const after = executeAutonomousPlan(
      project,
      [op("gap", "silence", 4, 5), cue],
      [asset, sound]
    );
    expect(after.clips.filter(c => c.assetId === sound.id)).toMatchObject([
      { start: 3, duration: 1, inPoint: 1, outPoint: 2 },
    ]);
    expect(cue.end).toBe(8);
    expect(cue.parameters?.sourceIn).toBe(1);
  });

  it("preserves existing audio and an intentional outro instead of trimming to picture coverage", () => {
    const music = {
      id: "music",
      kind: "audio",
      duration: 30,
      status: "ready",
    } as Asset;
    const outro = {
      ...project.clips[0],
      id: "outro",
      assetId: music.id,
      track: "audio" as const,
      start: 10,
      duration: 2,
      inPoint: 20,
      outPoint: 22,
      volume: 0.3,
    };
    const before = {
      ...project,
      duration: 12,
      clips: [...project.clips, outro],
    };
    const cut = op("gap", "silence", 4, 5);
    const withoutNewSound = executeAutonomousPlan(
      before,
      [cut],
      [asset, music]
    );
    const after = executeAutonomousPlan(
      before,
      [cut, op("bed", "sound", 0, 10, { assetId: music.id })],
      [asset, music]
    );
    expect(after.clips.find(c => c.id === outro.id)).toEqual(
      withoutNewSound.clips.find(c => c.id === outro.id)
    );
    expect(after.clips.find(c => c.id === outro.id)).toMatchObject({
      start: 9,
      duration: 2,
      inPoint: 20,
      outPoint: 22,
    });
    expect(after.duration).toBe(11);
    expect(
      Math.max(
        ...after.clips
          .filter(c => c.track === "video")
          .map(c => c.start + c.duration)
      )
    ).toBe(9);
    expect(before.clips.find(c => c.id === outro.id)).toEqual(outro);
  });

  it("keeps the original timeline domain while staging a short sound before an ending-gap cut", () => {
    const sound = {
      id: "sound",
      kind: "audio",
      duration: 2,
      status: "ready",
    } as Asset;
    const before = { ...project, duration: 12 };
    const after = executeAutonomousPlan(
      before,
      [
        op("ending-gap", "silence", 11, 12),
        op("cue", "sound", 1, 2, { assetId: sound.id }),
      ],
      [asset, sound]
    );
    expect(after.clips.find(c => c.id === "picture")).toEqual(project.clips[0]);
    expect(after.clips.find(c => c.id === "cue")).toMatchObject({
      start: 1,
      duration: 1,
      inPoint: 0,
      outPoint: 1,
    });
  });

  it.each([
    [3, 5, 4, 6],
    [3, 4, 3, 5],
    [3, 4, 4, 5],
  ])(
    "keeps new audio sample-aligned with existing audio for successive cuts %s–%s and %s–%s",
    (a, b, c, d) => {
      const music = {
        id: "music",
        kind: "audio",
        duration: 20,
        status: "ready",
      } as Asset;
      const cuts = [
        op("first", "silence", a, b),
        op("second", "silence", c, d),
      ];
      const originalAudio = {
        ...project.clips[0],
        id: "existing-audio",
        assetId: music.id,
        track: "audio" as const,
        inPoint: 2,
        outPoint: 12,
      };
      const before = { ...project, clips: [...project.clips, originalAudio] };
      const after = executeAutonomousPlan(
        before,
        [
          ...cuts,
          op("new-audio", "sound", 0, 10, { assetId: music.id, sourceIn: 2 }),
        ],
        [asset, music]
      );
      const samples = (prefix: string) =>
        after.clips
          .filter(clip => clip.id.startsWith(prefix))
          .sort((x, y) => x.start - y.start)
          .map(clip => [
            clip.start,
            clip.duration,
            clip.inPoint,
            clip.outPoint,
          ]);
      expect(samples("new-audio")).toEqual(samples("existing-audio"));
      expect(samples("new-audio").length).toBeGreaterThan(0);
      expect(before.clips.find(clip => clip.id === originalAudio.id)).toEqual(
        originalAudio
      );
    }
  );

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
      provenance: {
        recordId: "signed-plan",
        origin: "ai-assisted",
        operation: "edit-planning",
        provider: "fixture",
        model: "fixture",
        generatedAt: "2026-10-25T18:00:00Z",
        policyVersion: AI_COMPLIANCE_POLICY_VERSION,
        marking: {
          scheme: AI_PROVENANCE_SCHEME,
          method: "signed-record+sha256-fingerprint",
          status: "verified",
        },
      } satisfies NonNullable<EditOperation["provenance"]>,
    };
    const original = structuredClone(action);
    const before = { ...project, proposedChanges: [action] };
    expect(() =>
      preflightAutonomousPlan(before, [action], [asset, sound])
    ).not.toThrow();
    // The final pass resolves the catalog placeholder to the user's uploaded asset.
    const uploaded = {
      ...sound,
      id: "saved-audio",
      variantGroupId: `builtin-audio:${entry.id}`,
    };
    const executable = {
      ...action,
      parameters: { ...action.parameters, assetId: uploaded.id },
    };
    const after = executeAutonomousPlan(
      before,
      [executable],
      [asset, uploaded]
    );
    const cue = after.clips.find(c => c.id === action.id)!;
    expect(cue).toMatchObject({
      start: 8,
      inPoint: 0.1,
      assetId: uploaded.id,
      volume: 0.15,
    });
    expect(cue.duration).toBeCloseTo(entry.duration - 0.1, 12);
    expect(cue.outPoint).toBeCloseTo(entry.duration, 12);
    expect(cue.start + cue.duration).toBeLessThan(original.end);
    expect(cue.speed).toBeUndefined();
    expect(after.duration).toBe(project.duration);
    expect(after.proposedChanges[0]).toEqual({
      ...original,
      status: "accepted",
      reviewedAt: expect.any(String),
    });
    expect(action).toEqual(original);
    expect(executable.end).toBe(10);
    expect(before.proposedChanges[0]).toEqual(original);
    expect(auditAutomatedEdit(before, after, [asset, uploaded])).toEqual([]);
  });
  it("preserves a shorter requested sound interval and never extends a sound beyond its approved range", () => {
    const sound = {
      id: "sound",
      kind: "audio",
      duration: 1,
      status: "ready",
    } as Asset;
    const action = op("short-cue", "sound", 2.5, 2.7, {
      assetId: sound.id,
      sourceIn: 0.25,
    });
    const after = executeAutonomousPlan(project, [action], [asset, sound]);
    const cue = after.clips.find(c => c.id === action.id)!;
    expect(cue.start).toBe(action.start);
    expect(cue.duration).toBeCloseTo(0.2);
    expect(cue.inPoint).toBe(0.25);
    expect(cue.outPoint).toBeCloseTo(0.45);
    expect(cue.start + cue.duration).toBeLessThanOrEqual(action.end);
  });
  it("still rejects missing or invalid audio, empty source offsets and invalid timeline intervals", () => {
    const sound = {
      id: "sound",
      kind: "audio",
      duration: 0.6,
      status: "ready",
    } as Asset;
    const action = op("cue", "sound", 8, 10, { assetId: sound.id });
    for (const sourceIn of [-1, NaN, Infinity, 0.6, 1])
      expect(() =>
        executeAutonomousPlan(
          project,
          [{ ...action, parameters: { ...action.parameters, sourceIn } }],
          [asset, sound]
        )
      ).toThrow(/sound placement/);
    for (const duration of [undefined, 0, -1, NaN, Infinity])
      expect(() =>
        executeAutonomousPlan(
          project,
          [action],
          [asset, { ...sound, duration }]
        )
      ).toThrow(/sound placement/);
    for (const [start, end] of [
      [-1, 1],
      [NaN, 10],
      [8, Infinity],
      [8, 8],
      [8, 10.1],
    ])
      expect(() =>
        executeAutonomousPlan(
          project,
          [{ ...action, start, end }],
          [asset, sound]
        )
      ).toThrow(/sound placement/);
    expect(() => executeAutonomousPlan(project, [action], [asset])).toThrow(
      /sound placement/
    );
    expect(() =>
      executeAutonomousPlan(
        project,
        [action],
        [asset, { ...sound, kind: "video" }]
      )
    ).toThrow(/sound placement/);
    expect(() =>
      executeAutonomousPlan(
        { ...project, clips: project.clips.map(c => ({ ...c, locked: true })) },
        [action],
        [asset, sound]
      )
    ).toThrow(/locked/);
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
    const applied: EditOperation[] = [];
    const result = executeAutonomousPlan(
      { ...project, transcript: [caption] },
      [
        op("repeat", "caption", 1, 3, { text: caption.text }),
        op("look", "style", 0, 10, { brightness: 0.1 }),
      ],
      [asset],
      undefined,
      (_snapshot, operation) => applied.push(operation)
    );
    expect(result.transcript).toEqual([caption]);
    expect(applied.map(operation => operation.id)).toEqual(["look"]);
    expect(
      autonomousResultReceipt(
        "Added captions and updated the look.",
        applied,
        { changes: [], omitted: [], warnings: [] },
        text => text
      ).summary
    ).toBe("Updated the visual treatment.");
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
