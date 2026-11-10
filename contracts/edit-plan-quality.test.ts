import { describe, expect, it } from "vitest";
import type { Asset, EditOperation, EditProject } from "./workspace";
import { normalizeGraphic } from "./motion-graphics";
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

  it("can replace an unsupported overlay with a local visual emphasis without changing speech, source clocks or the accepted grade", () => {
    const review = reviewEditPlanGraphics(
      project,
      [grade, bad],
      [asset],
      "",
      checkpoint
    );
    const repaired = mergeGraphicRefinement(
      [grade, bad],
      review.omitted,
      {
        summary: "Local visual emphasis with the original grade",
        corrections: [
          {
            operationId: bad.id,
            operation: operation("temporary", "style", {
              visual: { scale: 1.04 },
            }),
          },
        ],
      },
      compile
    );
    expect(repaired.changes[0]).toBe(grade);
    expect(repaired.changes[1]).toMatchObject({
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
      visual: { scale: 1.04 },
    });
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
