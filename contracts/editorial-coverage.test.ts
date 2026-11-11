import { describe, expect, it } from "vitest";
import type { Asset, EditOperation, EditProject } from "./workspace";
import { buildEditPlanningContext } from "./edit-planning-context";
import { normalizeGraphic } from "./motion-graphics";
import {
  normalizeEditorialCoverage,
  reconcileEditorialCoverage,
  reviewAppliedEditorialCoverage,
  reviewEditorialCoverage,
} from "./editorial-coverage";

const asset = {
  id: "source",
  kind: "video",
  status: "ready",
  duration: 10,
} as Asset;
const project = {
  id: "edit",
  duration: 10,
  aspectRatio: "9:16",
  transcript: [],
  clips: [0, 5].map((start, index) => ({
    id: `clip-${index}`,
    assetId: asset.id,
    track: "video",
    label: "Speech",
    start,
    duration: 5,
    inPoint: start,
    outPoint: start + 5,
    locked: false,
    color: "#fff",
  })),
  sourceSpeech: [
    {
      assetId: asset.id,
      segments: [
        {
          id: "speech-a",
          start: 0,
          end: 4,
          text: "First demonstration",
          words: [],
        },
        { id: "speech-b", start: 5, end: 9, text: "The result", words: [] },
      ],
    },
  ],
  sourceReviews: [
    {
      assetId: asset.id,
      reviewedAt: "2026-11-11",
      summary: "",
      captions: "absent",
      audio: "present",
      captionNote: "",
      audioNote: "",
      moments: [],
      observations: [
        {
          start: 0,
          end: 5,
          visualEvidence: "Speaker demonstrates the first step with a red prop",
          audioEvidence: "First demonstration",
          confidence: 0.9,
        },
        {
          start: 5,
          end: 10,
          visualEvidence: "Speaker shows the result with a blue prop",
          audioEvidence: "The result",
          confidence: 0.9,
        },
      ],
    },
  ],
} as EditProject;
const context = buildEditPlanningContext(project, [asset]);
const preserve = () =>
  context.scenes.map((scene, index) => ({
    sceneId: scene.id,
    purpose: index
      ? "Deliver the demonstrated result"
      : "Establish the first step",
    decision: "preserve",
    reason: index
      ? "The blue prop and measured explanation show the result clearly."
      : "The red prop demonstrates the step during the speaker's complete explanation.",
    evidence: { speechIds: scene.speechIds, observationIndexes: [0] },
    operationIndexes: [] as number[],
  }));
const operation = (
  id: string,
  type: EditOperation["type"],
  patch: Partial<EditOperation> = {}
): EditOperation => ({
  id,
  type,
  start: 0,
  end: 5,
  label: id,
  reason: "A measured change",
  confidence: 0.9,
  intensity: "light",
  targetClipIds: ["clip-0"],
  status: "proposed",
  ...patch,
});
const cosmetic = [
  operation("grade", "style", { parameters: { contrast: 1.05 } }),
  operation("zoom", "style", { parameters: { visual: { scale: 1.1 } } }),
  ...Array.from({ length: 4 }, (_, index) =>
    operation(`sfx-${index}`, "sound", {
      parameters: { assetId: "catalog:cue", volume: 0.1 },
    })
  ),
];

describe("source-linked editorial coverage", () => {
  it("does not call grade, zoom and four SFX a resolved content improvement", () => {
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "improve",
      purpose: "Explain the missing step",
      operationIndexes: cosmetic.map((_, index) => index),
    };
    const result = reviewEditorialCoverage(
      decisions,
      project,
      context,
      cosmetic
    );
    expect(result.status).toBe("partial");
    expect(result.scenes[0].issues).toEqual(["cosmetic-only"]);
    expect(result.scenes[1].issues).toEqual([]);
  });

  it("accepts evidence-supported preservation without forcing any new effects", () => {
    const result = reviewEditorialCoverage(preserve(), project, context, []);
    expect(result.status).toBe("accounted");
    expect(result.scenes.every(scene => scene.decision === "preserve")).toBe(
      true
    );
    expect(
      reviewEditorialCoverage(preserve(), project, context, cosmetic).status
    ).toBe("accounted");
  });

  it("does not let decorative catalog broll stand in for a missing demonstration", () => {
    const imported = {
      ...asset,
      id: "imported-frame",
      catalog: { id: "stock-frame" },
    } as Asset;
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "improve",
      operationIndexes: [0],
    };
    for (const assetId of ["shared:stock-frame", imported.id]) {
      const frame = operation("frame", "broll", { parameters: { assetId } });
      const checked = reviewEditorialCoverage(
        decisions,
        project,
        context,
        [frame],
        [imported]
      );
      expect(checked.status).toBe("partial");
      expect(checked.scenes[0].issues).toContain("cosmetic-only");
      expect(
        reviewAppliedEditorialCoverage(
          checked,
          project,
          context,
          [frame],
          [imported]
        ).status
      ).toBe("partial");
      expect(
        reviewEditorialCoverage(
          preserve(),
          project,
          context,
          [frame],
          [imported]
        ).status
      ).toBe("accounted");
    }
  });

  it("accepts a source-linked supporting shot and binds it to the stable operation ID", () => {
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "improve",
      operationIndexes: [1],
    };
    const supporting = operation("support", "broll", {
      parameters: { assetId: "owned-detail" },
    });
    const result = reviewEditorialCoverage(decisions, project, context, [
      cosmetic[0],
      supporting,
    ]);
    expect(result.status).toBe("accounted");
    expect(result.scenes[0].operationIds).toEqual(["support"]);
    expect(
      reviewAppliedEditorialCoverage(result, project, context, [supporting])
        .status
    ).toBe("accounted");
  });

  it("retains missing speech or source limitations as unresolved, without inventing extra edits", () => {
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "blocked",
      reason:
        "The source does not contain the spoken explanation needed for this step.",
    };
    const result = reviewEditorialCoverage(
      decisions,
      project,
      context,
      cosmetic
    );
    expect(result.status).toBe("partial");
    expect(result.scenes[0].issues).toContain("unresolved-source");
    expect(result.scenes[0].reason).toContain("does not contain");
  });

  it("cannot preserve an unobserved source or pass an empty source review", () => {
    const unknown = { ...project, sourceReviews: [], sourceSpeech: [] };
    const unknownContext = buildEditPlanningContext(unknown, [asset]);
    const result = reviewEditorialCoverage(
      preserve(),
      unknown,
      unknownContext,
      []
    );
    expect(result.status).toBe("partial");
    expect(
      result.scenes.every(scene => scene.issues.includes("missing-evidence"))
    ).toBe(true);
    expect(
      reviewEditorialCoverage([], project, { scenes: [] }, []).status
    ).toBe("partial");
    const noPicture = buildEditPlanningContext(unknown, []);
    expect(reviewEditorialCoverage([], unknown, noPicture, []).status).toBe(
      "partial"
    );
  });

  it("makes omitted scene decisions, duplicate scenes and mismatched evidence visible", () => {
    expect(
      reviewEditorialCoverage(preserve().slice(0, 1), project, context, [])
        .scenes[1].issues
    ).toContain("missing-decision");
    const duplicate = preserve();
    duplicate.push(duplicate[0]);
    expect(
      reviewEditorialCoverage(duplicate, project, context, []).scenes[0].issues
    ).toContain("missing-decision");
    const invalid = preserve();
    invalid[0].evidence = {
      speechIds: ["speech:999"],
      observationIndexes: [77],
    };
    expect(
      reviewEditorialCoverage(invalid, project, context, []).scenes[0].issues
    ).toEqual(expect.arrayContaining(["missing-evidence", "invalid-evidence"]));
  });

  it("keeps an internal timeline gap unresolved when the surrounding scenes are preserved", () => {
    const gapped = {
      ...project,
      clips: [
        project.clips[0],
        { ...project.clips[1], start: 7, duration: 3, outPoint: 8 },
      ],
    };
    const gapContext = buildEditPlanningContext(gapped, [asset]);
    const decisions = gapContext.scenes
      .filter(scene => scene.pictureAvailable)
      .map(scene => ({
        sceneId: scene.id,
        purpose: "Keep the demonstrated source",
        decision: "preserve",
        reason:
          "The source shows the demonstration during its complete explanation.",
        evidence: { speechIds: scene.speechIds, observationIndexes: [0] },
        operationIndexes: [],
      }));
    const checked = reviewEditorialCoverage(decisions, gapped, gapContext, []);
    expect(checked.status).toBe("partial");
    expect(
      checked.scenes.find(scene => scene.start === 5 && scene.end === 7)?.issues
    ).toEqual(expect.arrayContaining(["missing-decision", "missing-evidence"]));
  });

  it("does not count duplicate source footage or already-present caption text as new content", () => {
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "improve",
      operationIndexes: [0],
    };
    const captioned = {
      ...project,
      transcript: [
        {
          id: "caption",
          start: 0,
          end: 5,
          text: "First demonstration!",
          words: [],
        },
      ],
    };
    for (const unchanged of [
      operation("same-picture", "broll", {
        parameters: { assetId: asset.id, sourceIn: 0 },
      }),
      operation("same-caption", "caption", {
        parameters: { text: "first demonstration" },
      }),
    ]) {
      expect(
        reviewEditorialCoverage(decisions, captioned, context, [unchanged])
          .scenes[0].issues
      ).toContain("unchanged-operation");
    }
  });

  it("rejects generic preservation without a source-based reason", () => {
    const decisions = preserve();
    decisions[0].reason = "";
    expect(
      reviewEditorialCoverage(decisions, project, context, []).scenes[0].issues
    ).toContain("missing-reason");
  });

  it("does not count a content operation on another scene", () => {
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "improve",
      operationIndexes: [0],
    };
    const elsewhere = operation("elsewhere", "broll", {
      start: 5,
      end: 10,
      parameters: { assetId: "detail" },
    });
    expect(
      reviewEditorialCoverage(decisions, project, context, [elsewhere])
        .scenes[0].issues
    ).toContain("unrelated-operation");
  });

  it("does not count a split, unchanged trim, move or playback speed as content improvement", () => {
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "improve",
      operationIndexes: [0],
    };
    for (const unchanged of [
      operation("trim", "trim", { parameters: { sourceIn: 0 } }),
      operation("move", "move", { parameters: { destination: 0 } }),
      operation("speed", "pacing", { parameters: { speed: 1 } }),
    ])
      expect(
        reviewEditorialCoverage(decisions, project, context, [unchanged])
          .scenes[0].issues
      ).toContain("unchanged-operation");
    expect(
      reviewEditorialCoverage(decisions, project, context, [
        operation("split", "split"),
      ]).scenes[0].issues
    ).toContain("cosmetic-only");
  });

  it("does not count a color-only or identical graphic update as a new explanation", () => {
    const graphic = normalizeGraphic({
      kind: "text",
      text: "First demonstration",
      x: 35,
      color: "#ffffff",
    })!;
    const withGraphic = {
      ...project,
      clips: [...project.clips, { ...project.clips[0], id: "card", graphic }],
    };
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "improve",
      operationIndexes: [0],
    };
    for (const replacement of [graphic, { ...graphic, color: "#ff0000" }]) {
      const update = operation("update", "graphic", {
        targetClipIds: ["card"],
        parameters: { graphicMode: "update", graphic: replacement },
      });
      expect(
        reviewEditorialCoverage(decisions, withGraphic, context, [update])
          .scenes[0].issues
      ).toContain("unchanged-operation");
    }
  });

  it("keeps an objective unresolved when graphic correction becomes color or withdrawal", () => {
    const decisions = preserve();
    decisions[0] = {
      ...decisions[0],
      decision: "improve",
      operationIndexes: [0],
    };
    const original = operation("card", "graphic", {
      parameters: {
        graphic: normalizeGraphic({
          kind: "text",
          text: "First demonstration",
        })!,
      },
    });
    const reviewed = reviewEditorialCoverage(decisions, project, context, [
      original,
    ]);
    expect(reviewed.status).toBe("accounted");
    expect(
      reconcileEditorialCoverage(reviewed, [{ ...cosmetic[0], id: "card" }])
        .scenes[0].issues
    ).toContain("cosmetic-only");
    expect(reconcileEditorialCoverage(reviewed, []).scenes[0].issues).toContain(
      "missing-operation"
    );
    expect(
      reviewAppliedEditorialCoverage(reviewed, project, context, []).status
    ).toBe("partial");
  });

  it("does not turn missing or malformed persisted review data into complete coverage", () => {
    expect(
      reviewAppliedEditorialCoverage(undefined, project, context, cosmetic)
        .status
    ).toBe("partial");
    for (const value of [
      { version: 1, scenes: [] },
      { version: 1, status: "accounted", scenes: [] },
    ])
      expect(normalizeEditorialCoverage(value)?.status).toBe("partial");
    const complete = reviewEditorialCoverage(preserve(), project, context, []);
    expect(normalizeEditorialCoverage(complete)).toEqual(complete);
    expect(
      normalizeEditorialCoverage({ ...complete, status: "invented" })?.status
    ).toBe("partial");
    expect(
      normalizeEditorialCoverage({
        ...complete,
        scenes: [{ ...complete.scenes[0], issues: ["invented"] }],
      })?.status
    ).toBe("partial");
  });
});
