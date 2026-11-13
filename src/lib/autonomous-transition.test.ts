import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  Asset,
  EditOperation,
  EditProject,
  TimelineClip,
} from "@contracts/workspace";
import {
  applyAutonomousTransition,
  buildAutonomousTransitionContext,
  normalizeAutonomousTransition,
} from "@contracts/autonomous-transition";
import {
  buildEditPlanningContext,
  resolveEditPlanningReferences,
  assertExecutableEditPlan,
} from "@contracts/edit-planning-context";
import {
  draftAutonomousPlan,
  executeAutonomousPlan,
  preflightAutonomousPlan,
} from "./autonomous-execution";
import { applyEditOperation } from "./edit-timeline";
import { visualFrame } from "@contracts/clip-visual";
import { normalizeEditorChatState } from "@contracts/editor-chat-state";
import { autonomousResultReceipt } from "./autonomous-result-receipt";
import { buildRenderPlan } from "./render-plan";

const assets = ["red", "blue", "green"].map(
  id => ({ id, kind: "video", status: "ready", duration: 12 }) as Asset
);
const shot = (id: string, start: number): TimelineClip => ({
  id,
  assetId: id,
  track: "video",
  lane: 1,
  label: id,
  start,
  duration: 3,
  inPoint: 1,
  outPoint: 4,
  speed: 1,
  locked: false,
  color: "#ffffff",
  volume: 0.8,
});
const fixture = (): EditProject => ({
  id: "p",
  title: "Transition test",
  status: "editing",
  template: "blank",
  platform: "instagram",
  aspectRatio: "1:1",
  frameRate: 30,
  duration: 6,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  revisions: [],
  qualitySignals: [],
  proposedChanges: [],
  clips: [shot("red", 0), shot("blue", 3)],
  transcript: [
    {
      id: "cue",
      sourceClipId: "red",
      start: 0.4,
      end: 1.2,
      text: "Actual words",
    },
  ],
});
const operation = (
  id: string,
  type: EditOperation["type"],
  start: number,
  end: number,
  targetClipIds: string[],
  parameters: EditOperation["parameters"] = {}
): EditOperation => ({
  id,
  type,
  label: id,
  reason: "Measured cut",
  start,
  end,
  targetClipIds,
  parameters,
  confidence: 1,
  intensity: "balanced",
  status: "proposed",
});
const transition = (
  cutTime = 3,
  outgoingId = "red",
  incomingId = "blue",
  duration = 0.6
) =>
  operation(
    `transition-${cutTime}`,
    "transition",
    cutTime - duration / 2,
    cutTime + duration / 2,
    [...new Set([outgoingId, incomingId])],
    {
      transition: {
        outgoingId,
        incomingId,
        cutTime,
        kind: "dissolve",
        duration,
      },
    }
  );

describe("automatic adjacent-shot transitions", () => {
  it("tracks supporting-media ownership through cuts while excluding transition handles", () => {
    const p = fixture();
    p.duration = 8;
    p.transcript = [];
    p.clips = [{ ...shot("red", 0), duration: 8, outPoint: 9 }];
    const { draft, mediaOwners } = draftAutonomousPlan(
      p,
      [
        operation("insert", "broll", 2, 6, [], {
          assetId: "blue",
          sourceIn: 1,
        }),
        operation("gap", "silence", 3, 3.2, []),
      ],
      assets
    );
    const inserts = draft.clips.filter(c => c.assetId === "blue");
    expect(inserts).toHaveLength(2);
    for (const clip of inserts) expect(mediaOwners.get(clip.id)).toBe("insert");
    for (const clip of draft.clips.filter(c => c.assetId === "red"))
      expect(mediaOwners.has(clip.id)).toBe(false);
    const transitioned = draftAutonomousPlan(fixture(), [transition()], assets);
    expect(transitioned.mediaOwners.size).toBe(0);
  });

  it("compiles a real preset and advertises measured handles without inventing cuts", () => {
    const project = fixture();
    const personal = [
      {
        id: "my-wipe",
        name: "My wipe",
        kind: "wipe-left" as const,
        duration: 0.3,
      },
    ];
    const context = buildEditPlanningContext(
      project,
      assets,
      [],
      [],
      {},
      personal
    );
    expect(context.transitionCuts).toContainEqual(
      expect.objectContaining({
        outgoingId: "red",
        incomingId: "blue",
        cutTime: 3,
        maxDuration: 1.5,
      })
    );
    expect(context.transitionSources[1]).toMatchObject({
      headHandleSeconds: 1,
      tailHandleSeconds: 8,
    });
    for (const presetId of ["dissolve-0.45", "my-wipe"]) {
      const [raw] = resolveEditPlanningReferences(
        [
          {
            type: "transition",
            parameters: {
              transition: {
                outgoingId: "red",
                incomingId: "blue",
                cutTime: 3,
                presetId,
              },
            },
          },
        ],
        context,
        project.duration
      ) as EditOperation[];
      const compiled = { ...transition(), ...raw };
      expect(compiled.parameters?.transition?.kind).toBe(
        presetId === "my-wipe" ? "wipe-left" : "dissolve"
      );
      expect(compiled.targetClipIds).toEqual(["red", "blue"]);
      expect(() => assertExecutableEditPlan([compiled])).not.toThrow();
      expect(() =>
        preflightAutonomousPlan(project, [compiled], assets)
      ).not.toThrow();
    }
    expect(
      normalizeAutonomousTransition({
        ...transition().parameters!.transition,
        presetId: "missing",
      })
    ).toBeUndefined();
    expect(
      normalizeAutonomousTransition({
        ...transition().parameters!.transition,
        presetId: "dissolve-0.45",
      })
    ).toBeUndefined();
    expect(() =>
      resolveEditPlanningReferences(
        [
          {
            type: "transition",
            parameters: {
              transition: {
                outgoingId: "red",
                incomingId: "blue",
                duration: 0.5,
                kind: "dissolve",
              },
            },
          },
        ],
        context,
        6
      )
    ).toThrow();
    expect(() =>
      resolveEditPlanningReferences([transition()], context, 6, ["red"])
    ).toThrow(/selected/);
  });

  it("applies and records the signed proposal while preserving speech, audio, duration and original input", () => {
    const p = fixture(),
      op = transition();
    p.proposedChanges = [op];
    const original = structuredClone(p);
    const after = executeAutonomousPlan(p, [op], assets);
    expect(after.duration).toBe(p.duration);
    expect(after.transcript).toEqual(p.transcript);
    expect(after.clips.filter(c => c.transitionHandle)).toHaveLength(2);
    expect(
      after.clips.filter(c => c.transitionHandle).every(c => c.muted)
    ).toBe(true);
    for (const before of p.clips)
      expect(after.clips.find(c => c.id === before.id)).toMatchObject({
        start: before.start,
        duration: before.duration,
        inPoint: before.inPoint,
        outPoint: before.outPoint,
        speed: before.speed,
        volume: before.volume,
      });
    expect(after.proposedChanges[0]).toMatchObject({
      ...op,
      status: "accepted",
      parameters: op.parameters,
    });
    expect(p).toEqual(original);
    expect(() => applyEditOperation(p, op)).toThrow(/complete plan executor/);
    const saved = normalizeEditorChatState({
      messages: [
        {
          id: "receipt",
          role: "assistant",
          createdAt: "2026-11-13T10:00:00Z",
          text: "Applied",
          activity: {
            kind: "auto-edit",
            steps: [op.label],
            appliedTypes: ["transition"],
          },
        },
      ],
    });
    expect(saved?.messages[0].activity?.appliedTypes).toEqual(["transition"]);
    expect(
      autonomousResultReceipt(
        "",
        [op],
        { changes: [op], omitted: [], warnings: [] },
        text => text
      ).summary
    ).toBe("Updated the visual treatment.");
  });

  it.each([NaN, Infinity, -Infinity])(
    "rejects a non-finite transition interval (%s) before execution",
    invalid => {
      for (const field of ["start", "end"] as const) {
        const op = transition();
        op[field] = invalid;
        expect(() => assertExecutableEditPlan([op])).toThrow(/interval/);
        const project = fixture();
        expect(() =>
          applyAutonomousTransition(project, project, op, assets, new Map())
        ).toThrow(/interval/);
      }
    }
  );

  it.each([
    "missing-handles",
    "locked",
    "missing-duration",
    "overlap",
    "audio-fade",
  ])("rejects %s before publishing any draft", failure => {
    const p = fixture(),
      media = structuredClone(assets),
      snapshot = structuredClone(p);
    if (failure === "missing-handles") {
      p.clips[1].inPoint = 0;
      p.clips[1].outPoint = 3;
    }
    if (failure === "locked") p.clips[0].locked = true;
    if (failure === "missing-duration") media[1].duration = undefined;
    if (failure === "overlap")
      p.clips.push({
        ...shot("green", 3.4),
        duration: 0.5,
        outPoint: 1.5,
        lane: 2,
      });
    if (failure === "audio-fade") p.clips[0].fadeOut = 0.2;
    const original = structuredClone(p);
    expect(() => preflightAutonomousPlan(p, [transition()], media)).toThrow();
    expect(p).toEqual(original);
    if (failure === "missing-handles" || failure === "locked")
      expect(
        buildAutonomousTransitionContext(p, media).transitionCuts
      ).toHaveLength(0);
    expect(snapshot.clips).toHaveLength(2);
  });

  it("resolves the actual boundary descendants after split and local grading, not the old ID's center slice", () => {
    const p = fixture();
    p.duration = 8;
    p.transcript = [];
    p.clips = [{ ...shot("red", 0), duration: 8, outPoint: 9 }];
    const op = transition(4, "red", "red");
    const changes = [
      op,
      operation("split", "split", 4, 4, ["red"]),
      operation("grade", "style", 2, 3, ["red"], { contrast: 1.1 }),
    ];
    const after = executeAutonomousPlan(p, changes, assets);
    const incoming = after.clips.find(c => c.shotTransition)!;
    expect(incoming.start).toBe(4);
    expect(incoming.shotTransition).toMatchObject({
      outgoingId: "red-grade-after",
      incomingId: "red-split",
    });
    expect(
      after.clips.find(c => c.id === "red")?.shotTransition
    ).toBeUndefined();
    expect(() => executeAutonomousPlan(p, [op], assets)).toThrow(
      /one surviving/
    );
    expect(() =>
      executeAutonomousPlan(
        p,
        [operation("split", "split", 5, 5, ["red"]), op],
        assets
      )
    ).toThrow(/one surviving/);
  });

  it("resolves a ripple gap across the original cut and retains the resulting speech clock", () => {
    const p = fixture();
    p.duration = 8;
    p.clips = [{ ...shot("red", 0), duration: 8, outPoint: 9 }];
    const gap = operation("gap", "silence", 3.8, 4.2, []);
    const cut = executeAutonomousPlan(p, [gap], assets);
    const after = executeAutonomousPlan(
      p,
      [transition(4, "red", "red"), gap],
      assets
    );
    expect(after.clips.find(c => c.shotTransition)?.start).toBeCloseTo(3.8);
    expect(after.duration).toBe(cut.duration);
    expect(after.transcript).toEqual(cut.transcript);
  });

  it("retains source identity after an explicit trim and move create the adjacent pair", () => {
    const p = fixture();
    p.duration = 8;
    p.clips = [
      { ...shot("red", 0), duration: 4, outPoint: 5 },
      { ...shot("blue", 4), duration: 4, outPoint: 5 },
    ];
    const changes = [
      transition(4),
      operation("trim", "trim", 0, 3, ["red"], { sourceIn: 1 }),
      operation("move", "move", 4, 8, ["blue"], { destination: 3 }),
    ];
    const after = executeAutonomousPlan(p, changes, assets);
    expect(after.clips.find(c => c.shotTransition)?.start).toBe(3);
    expect(after.duration).toBe(7);
  });

  it("rejects ambiguous source occurrences rather than choosing a matching ID prefix", () => {
    const p = fixture();
    p.duration = 20;
    p.transcript = [];
    p.clips = [{ ...shot("red", 0), duration: 8, outPoint: 9 }];
    const left = {
      ...shot("left", 0),
      assetId: "red",
      duration: 4,
      outPoint: 5,
    };
    const right = {
      ...shot("right", 4),
      assetId: "red",
      duration: 4,
      inPoint: 5,
      outPoint: 9,
    };
    const working = {
      ...p,
      clips: [
        left,
        right,
        { ...left, id: "left2", start: 10 },
        { ...right, id: "right2", start: 14 },
      ],
    };
    const roots = new Map(working.clips.map(c => [c.id, "red"]));
    expect(() =>
      applyAutonomousTransition(
        p,
        working,
        transition(4, "red", "red"),
        assets,
        roots
      )
    ).toThrow(/one surviving/);
  });

  it("supports both cuts in a three-shot sequence without overlapping handles or changing audio", () => {
    const p = fixture();
    p.duration = 9;
    p.clips.push(shot("green", 6));
    const after = executeAutonomousPlan(
      p,
      [transition(6, "blue", "green"), transition()],
      assets
    );
    expect(after.clips.filter(c => c.shotTransition)).toHaveLength(2);
    expect(after.clips.filter(c => c.transitionHandle)).toHaveLength(4);
    expect(
      after.clips.filter(c => c.transitionHandle).every(c => c.muted)
    ).toBe(true);
    expect(after.duration).toBe(9);
    const second = after.clips.find(c => c.id === "blue")!;
    expect(visualFrame(second, 3).opacity).toBeCloseTo(0.5);
    expect(visualFrame(second, 5).opacity).toBe(1);
    const updated = executeAutonomousPlan(
      after,
      [transition(3, "red", "blue", 0.4)],
      assets
    );
    expect(updated.clips.filter(c => c.shotTransition)).toHaveLength(2);
    expect(updated.clips.filter(c => c.transitionHandle)).toHaveLength(4);
    expect(
      updated.clips.find(c => c.id === "green")?.visual?.entrance.duration
    ).toBe(0.6);
    expect(
      updated.clips.find(c => c.id === "blue")?.visual?.entrance.duration
    ).toBe(0.4);
  });

  it("explicitly removes a saved transition before trimming/grading and then recreates it on the surviving cut", () => {
    const p = executeAutonomousPlan(fixture(), [transition()], assets);
    const context = buildEditPlanningContext(p, assets);
    expect(context.existingTransitions).toEqual([
      expect.objectContaining({
        outgoingId: "red",
        incomingId: "blue",
        cutTime: 3,
        start: 0,
        end: 6,
        locked: false,
      }),
    ]);
    const [raw] = resolveEditPlanningReferences(
      [
        {
          type: "transition",
          parameters: {
            transition: {
              outgoingId: "red",
              incomingId: "blue",
              cutTime: 3,
              kind: "none",
            },
          },
        },
      ],
      context,
      p.duration
    ) as EditOperation[];
    const removal = { ...transition(), ...raw, id: "remove" };
    expect(removal).toMatchObject({
      start: 0,
      end: 6,
      parameters: { transition: { kind: "none", duration: 0 } },
    });
    const trim = operation("trim", "trim", 3, 5.5, ["blue"], { sourceIn: 1 });
    const grade = operation("grade", "style", 3, 4.5, ["blue"], {
      contrast: 1.1,
    });
    const after = executeAutonomousPlan(
      p,
      [transition(), grade, trim, removal],
      assets
    );
    expect(after.clips.filter(c => c.transitionHandle)).toHaveLength(2);
    expect(after.clips.find(c => c.shotTransition)?.start).toBe(3);
    expect(after.transcript).toEqual(p.transcript);
    expect(after.clips.find(c => c.id === "blue")?.contrast).toBe(1.1);
    expect(() => executeAutonomousPlan(p, [trim, grade], assets)).toThrow(
      /Remove the transition/
    );
    expect(() =>
      resolveEditPlanningReferences(
        [{ ...removal, start: 2.7, end: 3.3 }],
        context,
        6
      )
    ).toThrow(/original transition cut/);
    expect(() =>
      resolveEditPlanningReferences([removal], context, 6, ["blue"])
    ).toThrow(/selected/);
    expect(
      normalizeAutonomousTransition({
        ...removal.parameters!.transition,
        duration: 0.3,
      })
    ).toBeUndefined();
  });

  it.each(["missing", "locked-shot", "locked-handle", "wrong-cut"])(
    "rejects %s transition removal without mutating the project",
    failure => {
      const p = executeAutonomousPlan(fixture(), [transition()], assets);
      if (failure === "missing")
        p.clips.find(c => c.id === "blue")!.shotTransition = undefined;
      if (failure === "locked-shot")
        p.clips.find(c => c.id === "red")!.locked = true;
      if (failure === "locked-handle")
        p.clips.find(c => c.transitionHandle)!.locked = true;
      const snapshot = structuredClone(p);
      const removal = operation("remove", "transition", 0, 6, ["red", "blue"], {
        transition: {
          outgoingId: "red",
          incomingId: "blue",
          cutTime: failure === "wrong-cut" ? 3.1 : 3,
          kind: "none",
          duration: 0,
        },
      });
      expect(() => executeAutonomousPlan(p, [removal], assets)).toThrow();
      expect(p).toEqual(snapshot);
    }
  );

  it("rejects a second transition when its handles collide with the first transition", () => {
    const p = fixture();
    p.clips[1] = {
      ...p.clips[1],
      duration: 0.5,
      outPoint: 1.5,
      visualDuration: 10,
    };
    p.clips.push(shot("green", 3.5));
    p.duration = 6.5;
    expect(() =>
      executeAutonomousPlan(
        p,
        [
          transition(3, "red", "blue", 0.8),
          transition(3.5, "blue", "green", 0.8),
        ],
        assets
      )
    ).toThrow(/overlaps/);
  });

  it("renders the planned transition into actual mixed MP4 frames without duplicate audio", () => {
    const dir = mkdtempSync(join(tmpdir(), "reel-auto-transition-"));
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
            `color=${color}:s=80x80:r=30:d=5`,
            "-f",
            "lavfi",
            "-i",
            `sine=frequency=${440 + index * 440}:duration=5`,
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
          { cwd: dir, timeout: 15000 }
        );
      const p = fixture();
      p.transcript = [];
      const after = executeAutonomousPlan(p, [transition()], assets);
      const plan = buildRenderPlan(after, assets, new Set(["red", "blue"]));
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
          "scale=8:8,select='eq(n,81)+eq(n,90)+eq(n,99)'",
          "-vsync",
          "0",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { cwd: dir, timeout: 15000 }
      );
      expect(bytes.length).toBe(3 * 8 * 8 * 3);
      const pixels = Array.from({ length: 3 }, (_, i) => [
        ...bytes.subarray(i * 192 + 84, i * 192 + 87),
      ]);
      expect(pixels[0][0]).toBeGreaterThan(235);
      expect(pixels[0][2]).toBeLessThan(15);
      expect(pixels[1][0]).toBeGreaterThan(90);
      expect(pixels[1][0]).toBeLessThan(165);
      expect(pixels[1][2]).toBeGreaterThan(90);
      expect(pixels[1][2]).toBeLessThan(165);
      expect(pixels[2][2]).toBeGreaterThan(235);
      expect(pixels[2][0]).toBeLessThan(15);
    } finally {
      if (dirname(resolve(dir)) === resolve(tmpdir()))
        rmSync(dir, { recursive: true, force: true });
    }
  }, 90000);
});
