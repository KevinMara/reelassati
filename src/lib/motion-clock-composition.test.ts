import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import type {
  Asset,
  EditOperation,
  EditProject,
  TimelineClip,
} from "@contracts/workspace";
import {
  normalizeVisual,
  visualFrame,
  visualProgress,
} from "@contracts/clip-visual";
import { orderAutonomousOperations } from "@contracts/autonomous-operation-order";
import { executeAutonomousPlan } from "./autonomous-execution";
import { applyEditOperation, rippleRemove } from "./edit-timeline";
import { visualRenderFilter } from "./visual-rendering";

const duration = 28.350708;
const source: TimelineClip = {
  id: "source-clip",
  assetId: "source",
  label: "Source",
  track: "video",
  start: 0,
  duration,
  inPoint: 0,
  outPoint: duration,
  speed: 1,
  volume: 1,
  locked: false,
  color: "#000000",
};
const asset = {
  id: "source",
  kind: "video",
  duration,
  status: "ready",
} as Asset;
const project = (clips = [source]): EditProject =>
  ({
    id: "project",
    duration: Math.max(...clips.map(clip => clip.start + clip.duration)),
    aspectRatio: "9:16",
    frameRate: 30,
    playhead: 0,
    clips,
    transcript: [
      {
        id: "cue",
        sourceClipId: source.id,
        start: 5.4,
        end: 5.9,
        text: "Measured speech",
        words: [
          { text: "Measured", start: 5.4, end: 5.6 },
          { text: "speech", start: 5.6, end: 5.9 },
        ],
      },
    ],
    sourceSpeech: [
      {
        assetId: asset.id,
        segments: [
          {
            id: "word",
            start: 5.4,
            end: 5.9,
            text: "Measured speech",
            words: [
              { text: "Measured", start: 5.4, end: 5.6 },
              { text: "speech", start: 5.6, end: 5.9 },
            ],
          },
        ],
      },
    ],
    proposedChanges: [],
    revisions: [],
    qualitySignals: [],
  }) as unknown as EditProject;
const operation = (
  id: string,
  type: EditOperation["type"],
  start: number,
  end: number,
  parameters: EditOperation["parameters"] = {}
): EditOperation => ({
  id,
  type,
  start,
  end,
  parameters,
  targetClipIds: [source.id],
  label: id,
  reason: "Measured source treatment",
  confidence: 1,
  intensity: "light",
  status: "proposed",
});
const push = (id: string, start: number, end: number, scale = 1.06) =>
  operation(id, "style", start, end, {
    visual: {
      keyframes: normalizeVisual({
        keyframes: [
          { at: 0, scale: 1 },
          { at: 1, scale },
        ],
      }).keyframes,
    },
  });

describe("motion clocks through composed source edits", () => {
  it.each([1, 2])(
    "keeps a new transition on its authored range through local grade splits at speed %s",
    speed => {
      const before = {
        ...project([
          {
            ...source,
            duration: 10,
            inPoint: 10,
            outPoint: 10 + 10 * speed,
            speed,
          },
        ]),
        transcript: [],
        sourceSpeech: [],
      };
      const transition = operation("transition", "style", 2, 8, {
        visual: {
          entrance: { kind: "dissolve", duration: 1 },
          exit: { kind: "dissolve", duration: 1 },
        },
      });
      const grades = [
        operation("early-grade", "style", 2.2, 2.4, { contrast: 1.1 }),
        operation("middle-grade", "style", 4, 6, { contrast: 1.1 }),
        operation("late-grade", "style", 7.6, 7.8, { contrast: 1.1 }),
      ];
      const measured = { ...asset, duration: 40 };
      const reference = executeAutonomousPlan(before, [transition], [measured]);
      const composed = executeAutonomousPlan(
        before,
        [...grades, transition],
        [measured]
      );
      const at = (value: EditProject, time: number) =>
        value.clips.find(c => c.start <= time && c.start + c.duration > time)!;
      for (const time of [2.1, 2.3, 2.5, 3.5, 4.1, 5.5, 6.1, 7.5, 7.7, 7.9]) {
        const clip = at(composed, time);
        expect(visualFrame(clip, time).opacity).toBeCloseTo(
          visualFrame(at(reference, time), time).opacity
        );
        expect(clip.visual?.entrance.at).toBeCloseTo(10 + 2 * speed);
        expect(clip.visual?.exit.at).toBeCloseTo(10 + 8 * speed);
      }
      const cut = rippleRemove(composed, 5, 5.2);
      expect(visualFrame(at(cut, 5.3), 5.3).opacity).toBe(1);
      expect(visualFrame(at(cut, 7.5), 7.5).opacity).toBeCloseTo(0.3);
    }
  );

  it("retains explicit transition source anchors without retiming an existing pose", () => {
    const before = {
      ...project([
        {
          ...source,
          duration: 10,
          inPoint: 10,
          outPoint: 30,
          speed: 2,
          visualStart: 10,
          visualDuration: 2,
          visual: normalizeVisual({
            keyframes: [
              { at: 0, scale: 1 },
              { at: 1, scale: 1.2 },
            ],
          }),
        },
      ]),
      transcript: [],
      sourceSpeech: [],
    };
    const after = executeAutonomousPlan(
      before,
      [
        operation("transition", "style", 2, 8, {
          visual: {
            entrance: { kind: "dissolve", duration: 2, at: 15 },
            exit: { kind: "dissolve", duration: 2, at: 25 },
          },
        }),
      ],
      [{ ...asset, duration: 40 }]
    );
    const clip = after.clips.find(c => c.start === 2)!;
    expect(clip.visualStart).toBe(10);
    expect(clip.visualDuration).toBe(2);
    expect(clip.visual?.entrance.at).toBe(15);
    expect(clip.visual?.exit.at).toBe(25);
    expect(visualFrame(clip, 3).opacity).toBeCloseTo(0.25);
    expect(visualFrame(clip, 7).opacity).toBeCloseTo(0.25);
    expect(visualFrame(clip, 3).scale).toBe(1.2);
  });

  it.each([false, true])(
    "renders the authored dissolve across a tiny split using the actual FFmpeg path (animated pose: %s)",
    animated => {
      const before = {
        ...project([
          {
            ...source,
            duration: 10,
            inPoint: 10,
            outPoint: 30,
            speed: 2,
            ...(animated
              ? {
                  visualStart: 10,
                  visualDuration: 2,
                  visual: normalizeVisual({
                    keyframes: [
                      { at: 0, scale: 1 },
                      { at: 1, scale: 1 },
                    ],
                  }),
                }
              : {}),
          },
        ]),
        transcript: [],
        sourceSpeech: [],
      };
      const transition = operation("transition", "style", 2, 8, {
        visual: { entrance: { kind: "dissolve", duration: 1 } },
      });
      const assets = [{ ...asset, duration: 40 }];
      const reference = executeAutonomousPlan(
        before,
        [transition],
        assets
      ).clips.find(c => c.start === 2)!;
      const after = executeAutonomousPlan(
        before,
        [operation("grade", "style", 2.2, 2.4, { contrast: 1.1 }), transition],
        assets
      );
      const piece = after.clips.find(c => Math.abs(c.start - 2.2) < 0.000001)!;
      const render = (clip: TimelineClip, frame: number) =>
        execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-filter_complex_threads",
            "1",
            "-f",
            "lavfi",
            "-i",
            "color=white:s=16x16:r=30:d=1,format=rgba",
            "-vf",
            `${visualRenderFilter(clip)},select='eq(n,${frame})',format=rgba`,
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { timeout: 10000, maxBuffer: 100000 }
        );
      const expected = render(reference, 9);
      const actual = render(piece, 3);
      expect(actual.length).toBe(16 * 16 * 4);
      expect(actual).toEqual(expected);
      expect(actual[3] / 255).toBeCloseTo(visualFrame(piece, 2.3).opacity, 2);
    }
  );

  it("round-trips transition spans while retaining legacy bounds and rejecting invalid spans", () => {
    const normalized = normalizeVisual({
      entrance: { kind: "dissolve", duration: 2, at: 10, sourceDuration: 12 },
      exit: { kind: "dissolve", duration: 2, at: 22, sourceDuration: 12 },
    });
    expect(normalizeVisual(JSON.parse(JSON.stringify(normalized)))).toEqual(
      normalized
    );
    for (const sourceDuration of [0, -1, Infinity, "12"])
      expect(
        normalizeVisual({ entrance: { sourceDuration } }).entrance
          .sourceDuration
      ).toBeUndefined();
    const legacy = {
      ...source,
      duration: 2,
      outPoint: 2,
      visual: normalizeVisual({ entrance: { kind: "dissolve", duration: 5 } }),
    };
    expect(visualFrame(legacy, 0.5).opacity).toBe(0.5);
  });

  it("keeps a legacy dissolve duration when a new pose uses a shorter clock", () => {
    const original = {
      ...source,
      visual: normalizeVisual({ entrance: { kind: "dissolve", duration: 2 } }),
    };
    const before = { ...project([original]), transcript: [], sourceSpeech: [] };
    const after = applyEditOperation(before, push("short-pose", 0, 1, 1.1));
    const animated = after.clips.find(c => c.start === 0)!;
    expect(animated.visualDuration).toBe(1);
    expect(visualFrame(animated, 0.5).opacity).toBeCloseTo(
      visualFrame(original, 0.5).opacity
    );
    expect(visualFrame(animated, 0.5).opacity).toBe(0.25);
  });

  it.each([false, true])(
    "preserves the real three-pause/two-push-in ranges independently of proposal order (reversed:%s)",
    reverse => {
      const repeated = { ...source, id: "repeat", start: 32 };
      const before = project([source, repeated]);
      const original = structuredClone(before);
      const operations = [
        operation("gap1", "silence", 4.9, 5.2),
        operation("gap2", "silence", 9.78, 10.08),
        operation("gap3", "silence", 22.88, 23.28),
        operation("grade", "style", 0, duration, {
          brightness: 0.02,
          contrast: 1.06,
          saturation: 1.05,
        }),
        push("early-motion", 4.2, 9.5),
        push("late-motion", 20.9, 24.2, 1.05),
        operation("split", "split", 7, 7),
      ];
      const plan = reverse ? [...operations].reverse() : operations;
      const order = orderAutonomousOperations(before, plan);
      expect(
        Math.max(
          ...order.flatMap((op, index) =>
            op.type === "style" || op.type === "split" ? [index] : []
          )
        )
      ).toBeLessThan(order.findIndex(op => op.type === "silence"));
      const after = executeAutonomousPlan(before, plan, [asset]);
      const early = after.clips
        .filter(clip => clip.visualStart === 4.2)
        .sort((a, b) => a.start - b.start);
      expect(early).toHaveLength(3); // A manual split at7 must not restart the path either.
      expect(early.map(clip => clip.inPoint)).toEqual([4.2, 5.2, 7]);
      for (const clip of early) {
        expect(clip.visualDuration).toBeCloseTo(5.3);
        expect(clip.outPoint).toBeLessThanOrEqual(9.5);
        expect(visualProgress(clip, clip.start)).toBeCloseTo(
          (clip.inPoint - 4.2) / 5.3
        );
        expect(clip.volume).toBe(1);
        expect(clip.contrast).toBe(1.06);
      }
      expect(early.at(-1)!.start + early.at(-1)!.duration).toBeCloseTo(9.2);
      expect(
        after.clips.some(clip => clip.visual && clip.duration < 0.03)
      ).toBe(false);
      const late = after.clips
        .filter(clip => clip.visualStart === 20.9)
        .sort((a, b) => a.start - b.start);
      expect(late).toHaveLength(2);
      expect(late.map(clip => clip.inPoint)).toEqual([20.9, 23.28]);
      for (const clip of late) expect(clip.visualDuration).toBeCloseTo(3.3);
      expect(late.at(-1)!.outPoint).toBeCloseTo(24.2);
      expect(visualProgress(late[1], late[1].start)).toBeCloseTo(
        (23.28 - 20.9) / 3.3
      );
      const untouchedOccurrence = after.clips.find(
        clip => clip.id === "repeat"
      )!;
      expect(untouchedOccurrence.start).toBeCloseTo(31);
      expect(untouchedOccurrence).toMatchObject({
        inPoint: repeated.inPoint,
        outPoint: repeated.outPoint,
        duration: repeated.duration,
        speed: repeated.speed,
        volume: repeated.volume,
      });
      expect(untouchedOccurrence.visual).toBeUndefined();
      expect(after.transcript[0].start).toBeCloseTo(5.1);
      expect(after.transcript[0].words?.[0].start).toBeCloseTo(5.1);
      expect(after.sourceSpeech).toEqual(original.sourceSpeech);
      expect(before).toEqual(original);
    }
  );

  it("maps a new path across pre-existing split targets at nonzero source offsets and speed, while retaining old transitions", () => {
    const animated = {
      ...source,
      start: 2,
      duration: 10,
      inPoint: 10,
      outPoint: 30,
      speed: 2,
      visualStart: 10,
      visualDuration: 20,
      visual: normalizeVisual({
        entrance: { kind: "dissolve", duration: 0.5 },
        exit: { kind: "dissolve", duration: 0.5 },
      }),
    };
    const before = { ...project([animated]), transcript: [], sourceSpeech: [] };
    const split = applyEditOperation(before, operation("seam", "split", 5, 5));
    const targets = split.clips.map(clip => clip.id);
    const styled = applyEditOperation(split, {
      ...push("path", 4, 8, 1.4),
      targetClipIds: targets,
    });
    const pieces = styled.clips.filter(clip => clip.visualDuration === 8);
    expect(pieces).toHaveLength(2);
    for (const clip of pieces) {
      expect(clip.visualStart).toBe(14);
      expect(clip.visual?.entrance.at).toBe(10);
      expect(clip.visual?.exit.at).toBe(30);
    }
    expect(visualFrame(pieces[0], 5).scale).toBeCloseTo(
      visualFrame(pieces[1], 5).scale
    );
    expect(visualProgress(pieces[1], 5)).toBe(0.25);
    const cut = rippleRemove(styled, 5.5, 6);
    const following = cut.clips.find(clip => clip.inPoint === 18)!;
    expect(following.visualStart).toBe(14);
    expect(following.visualDuration).toBe(8);
    expect(visualFrame(following, 5.5).scale).toBeCloseTo(
      visualFrame(pieces[1], 6).scale
    );
    expect(visualRenderFilter(following)).toContain("(4+T*2)/8");
  });

  it("projects the identical preserved pose into preview and actual FFmpeg export after a cut", () => {
    const before = { ...project(), transcript: [], sourceSpeech: [] };
    const treatment = push("push", 4.2, 9.5, 1.6);
    const uncut = executeAutonomousPlan(
      before,
      [treatment],
      [asset]
    ).clips.find(clip => clip.visual)!;
    const cut = executeAutonomousPlan(
      before,
      [operation("pause", "silence", 4.9, 5.2), treatment],
      [asset]
    );
    const following = cut.clips.find(clip => clip.inPoint === 5.2)!;
    expect(visualFrame(following, following.start + 0.2).scale).toBeCloseTo(
      visualFrame(uncut, uncut.start + 1.2).scale
    );
    expect(visualRenderFilter(following)).toContain("(1+T*1)/5.3");
    const renderFrame = (clip: TimelineClip, seconds: number) =>
      execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-filter_complex_threads",
          "1",
          "-f",
          "lavfi",
          "-i",
          "color=black:s=64x64:r=30:d=2,format=rgba,drawbox=x=16:y=20:w=15:h=22:color=white:t=fill",
          "-vf",
          `${visualRenderFilter(clip)},select='eq(n,${Math.round(seconds * 30)})',format=rgba`,
          "-frames:v",
          "1",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { maxBuffer: 1_000_000 }
      );
    const reference = renderFrame(uncut, 1.2);
    const rendered = renderFrame(following, 0.2);
    expect(rendered.length).toBe(64 * 64 * 4);
    expect(rendered).toEqual(reference);
  });
});
