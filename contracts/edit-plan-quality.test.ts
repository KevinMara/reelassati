import { describe, expect, it } from "vitest";
import type { Asset, EditOperation, EditProject } from "./workspace";
import { normalizeGraphic } from "./motion-graphics";
import { visualFrame } from "./clip-visual";
import {
  editPlanGraphicFeedback,
  editPlanQualityAssets,
  mergeGraphicRefinement,
  reviewEditPlanGraphics,
} from "./edit-plan-quality";
import { preflightAutonomousPlan as clientPreflight } from "../src/lib/autonomous-execution";
import { executeAutonomousPlan } from "./autonomous-execution";

const asset = {
  id: "source",
  kind: "video",
  width: 1000,
  height: 1000,
  duration: 10,
  status: "ready",
} as Asset;
const project = {
  id: "project",
  duration: 10,
  aspectRatio: "1:1",
  frameRate: 30,
  clips: [
    {
      id: "picture",
      assetId: "source",
      label: "Source",
      track: "video",
      start: 0,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
      locked: false,
      volume: 1,
    },
  ],
  transcript: [],
  proposedChanges: [],
  sourceSpeech: [
    {
      assetId: "source",
      segments: [
        {
          id: "speech",
          start: 1,
          end: 3,
          text: "30 domande",
          words: [
            { text: "30", start: 1, end: 1.4 },
            { text: "domande", start: 1.4, end: 2 },
          ],
        },
      ],
    },
  ],
  sourceReviews: [
    {
      assetId: "source",
      visualProtection: {
        version: 1,
        sourceDuration: 10,
        coverage: "complete",
        reviewedRanges: [{ start: 0, end: 10 }],
        observedText: [],
        regions: [
          {
            id: "face",
            start: 0,
            end: 10,
            kind: "face",
            rect: { x: 0.3, y: 0.2, width: 0.4, height: 0.4 },
            confidence: 0.95,
          },
        ],
      },
    },
  ],
} as unknown as EditProject;
const operation = (
  id: string,
  type: EditOperation["type"],
  parameters: EditOperation["parameters"]
): EditOperation => ({
  id,
  type,
  label: id,
  reason: "Measured emphasis",
  start: 1,
  end: 4,
  targetClipIds: ["picture"],
  status: "proposed",
  confidence: 0.9,
  intensity: "light",
  parameters,
});
const grade = operation("grade", "style", { contrast: 1.03 });
const bad = operation("graphic", "graphic", {
  graphicMode: "create",
  graphic: normalizeGraphic({
    kind: "callout",
    text: "UNSUPPORTED CLAIM",
    x: 50,
    y: 40,
    size: 5,
    animation: "none",
  }),
});
const safe = {
  ...bad,
  parameters: {
    graphicMode: "create" as const,
    graphic: normalizeGraphic({
      kind: "callout",
      text: "30 domande",
      x: 50,
      y: 80,
      size: 4,
      animation: "none",
    }),
  },
};
const checkpoint = () => undefined;
const compile = (raw: unknown) => raw as EditOperation[];

describe("bounded graphic quality correction", () => {
  it("uses the same composed timeline and guard on client and server, then preserves voice and valid operation identity", () => {
    const assets = editPlanQualityAssets([asset], []);
    const original = [grade, bad];
    const review = reviewEditPlanGraphics(
      project,
      original,
      assets,
      "",
      checkpoint
    );
    expect(review).toEqual(
      clientPreflight(project, original, assets, checkpoint, { request: "" })
    );
    expect(review.omitted[0].issues.map(issue => issue.reason)).toEqual(
      expect.arrayContaining(["source-overlap", "unsupported-source-copy"])
    );
    const feedback = editPlanGraphicFeedback(
      project,
      original,
      assets,
      review,
      checkpoint
    );
    expect(feedback.geometry.protectedRegions[0]).toMatchObject({
      regionId: "face",
      samples: [
        { time: 0, canvasPercent: { x: 30, y: 20, width: 40, height: 40 } },
        expect.anything(),
        expect.anything(),
      ],
    });
    const repaired = mergeGraphicRefinement(
      original,
      review.omitted,
      {
        summary: "Source-supported emphasis and grade",
        corrections: [{ operationId: bad.id, operation: safe }],
      },
      compile
    );
    expect(repaired.changes[0]).toBe(grade);
    expect(repaired.changes[1].id).toBe(bad.id);
    expect(
      reviewEditPlanGraphics(project, repaired.changes, assets, "", checkpoint)
        .omitted
    ).toEqual([]);
    const result = executeAutonomousPlan(project, repaired.changes, assets);
    expect(
      result.clips
        .filter(clip => clip.assetId === asset.id)
        .every(clip => clip.volume === 1)
    ).toBe(true);
    expect(result.sourceSpeech).toEqual(project.sourceSpeech);
    expect(result.clips.find(clip => clip.graphic)?.graphic?.text).toBe(
      "30 domande"
    );
  });

  it("can replace an unsupported overlay with bounded color without changing speech, source clocks or accepted framing and grade", () => {
    const framing = operation("framing", "style", {
      visual: { scale: 1.04, x: 2 },
    });
    const original = [grade, framing, bad];
    const savedOriginal = structuredClone(original);
    const review = reviewEditPlanGraphics(
      project,
      original,
      [asset],
      "",
      checkpoint
    );
    const repaired = mergeGraphicRefinement(
      original,
      review.omitted,
      {
        summary: "Subtle local color with the original framing and grade",
        corrections: [
          {
            operationId: bad.id,
            operation: operation("temporary", "style", {
              saturation: 1.05,
            }),
          },
        ],
      },
      compile
    );
    expect(repaired.changes[0]).toBe(grade);
    expect(repaired.changes[1]).toBe(framing);
    expect(original).toEqual(savedOriginal);
    expect(repaired.changes[2]).toMatchObject({
      id: bad.id,
      type: "style",
      start: 1,
      end: 4,
    });
    expect(
      reviewEditPlanGraphics(project, repaired.changes, [asset], "", checkpoint)
        .omitted
    ).toEqual([]);
    const result = executeAutonomousPlan(project, repaired.changes, [asset]);
    expect(result.sourceSpeech).toEqual(project.sourceSpeech);
    expect(
      result.clips
        .filter(clip => clip.assetId === asset.id)
        .map(clip => [
          clip.start,
          clip.duration,
          clip.inPoint,
          clip.outPoint,
          clip.volume,
        ])
    ).toEqual([
      [0, 1, 0, 1, 1],
      [1, 3, 1, 4, 1],
      [4, 6, 4, 10, 1],
    ]);
    expect(result.clips.find(clip => clip.start === 1)).toMatchObject({
      contrast: 1.03,
      saturation: 1.05,
      visual: { scale: 1.04, x: 2, opacity: 1 },
    });
  });

  it("rejects the opacity-zero correction that otherwise passes graphic preflight and hides the source", () => {
    const invisible = operation("invisible", "style", {
      visual: { opacity: 0 },
    });
    // The general executor permits intentional opacity edits; a repair must
    // enforce its narrower scope before it reaches that executor.
    expect(
      reviewEditPlanGraphics(project, [invisible], [asset], "", checkpoint)
        .omitted
    ).toEqual([]);
    const unchecked = executeAutonomousPlan(project, [invisible], [asset]);
    const hiddenSource = unchecked.clips.find(clip => clip.start === 1)!;
    expect(visualFrame(hiddenSource, 2).opacity).toBe(0);
    const original = [grade, bad];
    const savedOriginal = structuredClone(original);
    const review = reviewEditPlanGraphics(
      project,
      original,
      [asset],
      "",
      checkpoint
    );
    expect(() =>
      mergeGraphicRefinement(
        original,
        review.omitted,
        {
          summary: "Claimed safe emphasis",
          corrections: [{ operationId: bad.id, operation: invisible }],
        },
        compile
      )
    ).toThrow(expect.objectContaining({ reason: "graphic_refinement_scope" }));
    expect(original).toEqual(savedOriginal);
  });

  it.each([
    { visual: { crop: { left: 40 } } },
    { visual: { x: 100 } },
    { visual: { y: -100 } },
    { visual: { scale: 1.04 } },
    { visual: { rotation: 90 } },
    { visual: { entrance: { kind: "dissolve", duration: 3 } } },
    { visual: { exit: { kind: "dissolve", duration: 3 } } },
    { visual: { keyframes: [{ time: 1, opacity: 0 }] } },
    { fit: "cover" },
    { fit: "contain" },
    { fadeIn: 3 },
    { fadeOut: 3 },
    { brightness: -1 },
    { exposure: 2 },
    { saturation: 0 },
    { temperature: Number.NaN },
    { highlights: Number.POSITIVE_INFINITY },
    { tint: "0.1" },
  ])(
    "rejects source-changing or unbounded style fallbacks without normalization: %j",
    parameters => {
      const review = reviewEditPlanGraphics(
        project,
        [bad],
        [asset],
        "",
        checkpoint
      );
      let compiled = false;
      expect(() =>
        mergeGraphicRefinement(
          [bad],
          review.omitted,
          {
            summary: "Claimed repair",
            corrections: [
              {
                operationId: bad.id,
                operation: { ...bad, type: "style", parameters },
              },
            ],
          },
          raw => {
            compiled = true;
            return compile(raw);
          }
        )
      ).toThrow(
        expect.objectContaining({ reason: "graphic_refinement_scope" })
      );
      expect(compiled).toBe(false);
    }
  );

  it("rejects unsafe controls introduced during compilation", () => {
    const review = reviewEditPlanGraphics(
      project,
      [bad],
      [asset],
      "",
      checkpoint
    );
    const correction = operation("temporary", "style", { saturation: 1.05 });
    expect(() =>
      mergeGraphicRefinement(
        [bad],
        review.omitted,
        {
          summary: "Subtle color",
          corrections: [{ operationId: bad.id, operation: correction }],
        },
        () => [
          {
            ...correction,
            parameters: { saturation: 1.05, visual: { opacity: 0 } },
          },
        ]
      )
    ).toThrow(expect.objectContaining({ reason: "graphic_refinement_scope" }));
  });

  it("records a deliberate withdrawal using an observed reason and keeps all other operations unchanged", () => {
    const review = reviewEditPlanGraphics(
      project,
      [grade, bad],
      [asset],
      "",
      checkpoint
    );
    const result = mergeGraphicRefinement(
      [grade, bad],
      review.omitted,
      {
        summary: "Retain the clear source; omit overlapping title",
        corrections: [
          { operationId: bad.id, withdraw: { reason: "source-overlap" } },
        ],
      },
      compile
    );
    expect(result.changes).toEqual([grade]);
    expect(result.changes[0]).toBe(grade);
    expect(result.qualityReview.withdrawn).toMatchObject([
      { operationId: bad.id, issues: [{ reason: "source-overlap" }] },
    ]);
  });

  it.each([
    { type: "sound", parameters: { assetId: "catalog:chill-lofi" } },
    {
      type: "broll",
      parameters: { prompt: "new generation", mediaKind: "image" },
    },
    { type: "caption", parameters: { text: "new speech" } },
    { type: "style", parameters: { volume: 0.1 } },
    { type: "style", parameters: { fadeIn: 1 } },
    { type: "style", parameters: { contrast: 2 } },
    { type: "style", parameters: { contrast: 1.05 } },
    { type: "graphic", targetClipIds: ["unrelated"] },
    { type: "graphic", start: 0 },
    { type: "graphic", end: 8 },
    {
      type: "graphic",
      parameters: { graphicMode: "update", graphic: safe.parameters!.graphic },
    },
  ])("rejects new scope or authorization: %j", patch => {
    const review = reviewEditPlanGraphics(
      project,
      [grade, bad],
      [asset],
      "",
      checkpoint
    );
    expect(() =>
      mergeGraphicRefinement(
        [grade, bad],
        review.omitted,
        {
          summary: "Changed",
          corrections: [
            { operationId: bad.id, operation: { ...safe, ...patch } },
          ],
        },
        compile
      )
    ).toThrow(expect.objectContaining({ reason: "graphic_refinement_scope" }));
  });

  it.each([
    { summary: "Claimed repair", corrections: [] },
    {
      summary: "Claimed repair",
      corrections: [{ operationId: "grade", operation: safe }],
    },
    {
      summary: "Claimed repair",
      corrections: [{ operationId: bad.id, withdraw: { reason: "invented" } }],
    },
    {
      summary: "Claimed repair",
      corrections: [{ operationId: bad.id, operation: safe }],
      changes: [],
    },
  ])(
    "rejects malformed, incomplete and immutable-operation rewrites: %j",
    response => {
      const review = reviewEditPlanGraphics(
        project,
        [grade, bad],
        [asset],
        "",
        checkpoint
      );
      expect(() =>
        mergeGraphicRefinement([grade, bad], review.omitted, response, compile)
      ).toThrow(
        expect.objectContaining({ reason: "graphic_refinement_invalid" })
      );
    }
  );

  it("does not turn cancellation into a repairable rejection", () => {
    const aborted = new DOMException("Canceled", "AbortError");
    expect(() =>
      reviewEditPlanGraphics(project, [bad], [asset], "", () => {
        throw aborted;
      })
    ).toThrow(aborted);
  });
});
