import { describe, expect, it } from "vitest";
import type {
  Asset,
  EditOperation,
  EditProject,
  TimelineClip,
} from "@contracts/workspace";
import type { SourceVisualEvidence } from "@contracts/source-visual-evidence";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { normalizeVisual } from "@contracts/clip-visual";
import {
  automaticGraphicIntent,
  automaticGraphicProblems,
  protectedSourceBounds,
} from "./automatic-graphic-protection";
import {
  autonomousGraphicReceipt,
  filterAutonomousGraphics,
  preflightAutonomousPlan,
} from "./autonomous-execution";

const asset = {
  id: "source",
  name: "Source",
  kind: "video",
  width: 1000,
  height: 1000,
  duration: 10,
} as Asset;
const source: TimelineClip = {
  id: "footage",
  assetId: asset.id,
  label: "Source",
  track: "video",
  start: 0,
  duration: 10,
  inPoint: 0,
  outPoint: 10,
  locked: false,
  color: "#000000",
};
const evidence = (
  patch: Partial<SourceVisualEvidence> = {}
): SourceVisualEvidence => ({
  version: 1,
  sourceDuration: 10,
  coverage: "complete",
  reviewedRanges: [{ start: 0, end: 10 }],
  regions: [],
  observedText: [],
  ...patch,
});
const region = (start = 0, end = 10) => ({
  id: "prop",
  start,
  end,
  kind: "text" as const,
  rect: { x: 0.4, y: 0.45, width: 0.2, height: 0.1 },
  confidence: 0.8,
});
const project = (
  protection: SourceVisualEvidence | undefined = evidence()
): EditProject =>
  ({
    id: "project",
    duration: 10,
    aspectRatio: "1:1",
    playhead: 0,
    clips: [source],
    transcript: [],
    proposedChanges: [],
    qualitySignals: [],
    revisions: [],
    sourceSpeech: [
      {
        assetId: asset.id,
        segments: [
          {
            id: "speech",
            start: 0,
            end: 10,
            text: "Short title A",
            words: [
              { text: "Short", start: 1.1, end: 1.4 },
              { text: "title", start: 1.4, end: 1.8 },
              { text: "A", start: 6.2, end: 6.4 },
            ],
          },
        ],
      },
    ],
    sourceReviews: [
      {
        assetId: asset.id,
        reviewedAt: "2026-10-26",
        summary: "Source",
        captions: "present",
        captionNote: "Labels",
        audio: "present",
        audioNote: "Speech",
        moments: [],
        visualProtection: protection,
      },
    ],
  }) as unknown as EditProject;
const graphic = (patch: Partial<TimelineClip> = {}): TimelineClip => ({
  id: "card",
  label: "Added card",
  start: 1,
  duration: 3,
  inPoint: 0,
  outPoint: 3,
  track: "overlay",
  locked: false,
  color: "#000000",
  graphic: normalizeGraphic({
    kind: "callout",
    text: "Short title",
    size: 5,
    x: 50,
    y: 50,
    animation: "none",
    color: "#FFFFFF",
    background: "#111111",
  })!,
  ...patch,
});
const operation = (clip = graphic()): EditOperation => ({
  id: clip.id,
  type: "graphic",
  label: clip.label,
  reason: "Automatic direction",
  start: clip.start,
  end: clip.start + clip.duration,
  parameters: { graphic: clip.graphic },
  targetClipIds: [],
  confidence: 0.9,
  intensity: "balanced",
  status: "proposed",
});
const reasons = (p: EditProject, g = graphic(), a = [asset]) =>
  automaticGraphicProblems(p, g, a).map(item => item.reason);

describe("source-aware automatic graphic placement", () => {
  it("uses source fit, fitted-canvas crop, flip, rotation and translation", () => {
    const canvas = { width: 100, height: 100 },
      wide = { width: 200, height: 100 };
    expect(
      protectedSourceBounds(
        source,
        2,
        { x: 0, y: 0, width: 1, height: 1 },
        wide,
        canvas
      )
    ).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    expect(
      protectedSourceBounds(
        { ...source, fit: "cover" },
        2,
        { x: 0, y: 0, width: 0.2, height: 1 },
        wide,
        canvas
      )
    ).toBeUndefined();
    const cropped = {
      ...source,
      visual: normalizeVisual({ crop: { left: 25 } }),
    };
    expect(
      protectedSourceBounds(
        cropped,
        2,
        { x: 0, y: 0, width: 0.2, height: 1 },
        wide,
        canvas
      )
    ).toBeUndefined();
    const posed = {
      ...source,
      visual: normalizeVisual({ x: 10, flipX: true, rotation: 90 }),
    };
    const bounds = protectedSourceBounds(
      posed,
      2,
      { x: 0.1, y: 0.2, width: 0.2, height: 0.1 },
      canvas,
      canvas
    )!;
    expect(bounds.x).toBeCloseTo(80);
    expect(bounds.y).toBeCloseTo(70);
    expect(bounds.width).toBeCloseTo(10);
    expect(bounds.height).toBeCloseTo(20);
  });

  it("clips post-transform transition reveals and ignores fully transparent footage", () => {
    const clip = {
      ...source,
      visual: normalizeVisual({ entrance: { kind: "wipe-left", duration: 1 } }),
    };
    const size = { width: 100, height: 100 };
    expect(
      protectedSourceBounds(
        clip,
        0.25,
        { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
        size,
        size
      )
    ).toBeUndefined();
    expect(
      protectedSourceBounds(
        { ...source, visual: normalizeVisual({ opacity: 0 }) },
        2,
        { x: 0, y: 0, width: 1, height: 1 },
        size,
        size
      )
    ).toBeUndefined();
  });

  it("detects prop occlusion but allows an evidenced clear placement", () => {
    const p = project(evidence({ regions: [region()] }));
    expect(reasons(p)).toContain("source-overlap");
    expect(
      reasons(
        p,
        graphic({ graphic: normalizeGraphic({ ...graphic().graphic, y: 15 })! })
      )
    ).toEqual([]);
  });

  it.each(["rectangle", "highlight"] as const)(
    "does not treat the empty interior of an outlined %s as source occlusion",
    kind => {
      const p = project(evidence({ regions: [region()] }));
      const g = graphic({
        graphic: normalizeGraphic({
          kind,
          text: "",
          x: 50,
          y: 50,
          width: 30,
          height: 30,
          strokeWidth: 0.4,
          animation: "none",
        })!,
      });
      expect(reasons(p, g)).not.toContain("source-overlap");
      if (kind === "rectangle") {
        g.graphic!.strokeWidth = 0;
        expect(reasons(p, g)).toContain("source-overlap");
      }
    }
  );

  it("maps protected source intervals through each trimmed and sped-up occurrence", () => {
    const p = project(evidence({ regions: [region(3, 4)] }));
    p.clips = [
      { ...source, start: 5, inPoint: 2, outPoint: 6, duration: 2, speed: 2 },
    ];
    expect(
      reasons(p, graphic({ start: 5.6, duration: 0.3, outPoint: 0.3 }))
    ).toContain("source-overlap");
    expect(
      reasons(
        p,
        graphic({
          start: 6.1,
          duration: 0.8,
          outPoint: 0.8,
          graphic: normalizeGraphic({ ...graphic().graphic, text: "A" })!,
        })
      )
    ).not.toContain("source-overlap");
  });

  it("checks animated graphics between their safe entrance and exit positions", () => {
    const p = project(
      evidence({
        regions: [
          { ...region(), rect: { x: 0.75, y: 0.45, width: 0.15, height: 0.1 } },
        ],
      })
    );
    const g = graphic({
      graphic: normalizeGraphic({
        ...graphic().graphic,
        motion: [
          { at: 0, x: 20, y: 50, scale: 1, rotation: 0 },
          { at: 0.5, x: 80, y: 50, scale: 1, rotation: 0 },
          { at: 1, x: 20, y: 50, scale: 1, rotation: 0 },
        ],
      })!,
    });
    expect(reasons(p, g)).toContain("source-overlap");
  });

  it("tracks source visual motion, and preserves animation clock after a trim", () => {
    const p = project(
      evidence({
        regions: [
          { ...region(), rect: { x: 0.1, y: 0.45, width: 0.1, height: 0.1 } },
        ],
      })
    );
    p.clips = [
      {
        ...source,
        visual: normalizeVisual({
          keyframes: [
            { at: 0, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
            { at: 0.5, x: 35, y: 0, scale: 1, rotation: 0, opacity: 1 },
            { at: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
          ],
        }),
        visualStart: 0,
        visualDuration: 10,
        inPoint: 4,
        outPoint: 7,
        duration: 3,
      },
    ];
    expect(reasons(p)).toContain("source-overlap");
  });

  it("does not count incomplete review ranges or missing dimensions as a clear frame", () => {
    const p = project(
      evidence({
        coverage: "partial",
        reviewedRanges: [
          { start: 0, end: 2 },
          { start: 2.001, end: 10 },
        ],
      })
    );
    expect(reasons(p)).toContain("unknown-source-layout");
    expect(
      reasons(project(), graphic(), [{ ...asset, width: undefined }])
    ).toContain("unknown-source-layout");
    const legacy = project();
    legacy.sourceReviews![0].visualProtection = undefined;
    expect(reasons(legacy)).toContain("unknown-source-layout");
  });

  it("allows known empty letterboxing without inventing clear space over unknown footage", () => {
    const p = project();
    p.sourceReviews![0].visualProtection = undefined;
    expect(
      reasons(
        p,
        graphic({
          graphic: normalizeGraphic({ ...graphic().graphic, y: 10 })!,
        }),
        [{ ...asset, width: 2000, height: 1000 }]
      )
    ).toEqual([]);
  });

  it("detects exact repeated source text and short secondary commentary", () => {
    const p = project(
      evidence({
        observedText: [
          {
            id: "label",
            start: 0,
            end: 10,
            text: "Short title",
            confidence: 0.9,
          },
        ],
      })
    );
    expect(reasons(p)).toContain("repeated-source-text");
    const note = graphic({
      duration: 1.6,
      outPoint: 1.6,
      graphic: normalizeGraphic({
        ...graphic().graphic,
        text: "Note this extra point",
        secondaryText: "Four more words here",
      })!,
    });
    expect(reasons(project(), note)).toContain("reading-time");
  });

  it("omits invented commentary by source grounding rather than a topic blacklist", () => {
    const p = project(
      evidence({
        observedText: [
          { id: "range", start: 1, end: 4, text: "9–12", confidence: 0.9 },
        ],
      })
    );
    for (const text of [
      "Missing 5–8",
      "Non è una diagnosi",
      "Our product is certified",
      "A completely new headline",
    ]) {
      expect(
        reasons(
          p,
          graphic({
            graphic: normalizeGraphic({ ...graphic().graphic, text })!,
          })
        )
      ).toContain("unsupported-source-copy");
    }
    expect(reasons(p)).not.toContain("unsupported-source-copy");
    expect(
      automaticGraphicProblems(
        p,
        graphic({
          graphic: normalizeGraphic({
            ...graphic().graphic,
            text: "Requested new title",
          })!,
        }),
        [asset],
        "requested"
      )
    ).toEqual([]);
  });

  it("does not borrow words from a different source interval or hidden source", () => {
    const p = project();
    p.sourceSpeech![0].segments[0] = {
      id: "late",
      start: 8,
      end: 10,
      text: "Short title",
    };
    expect(reasons(p)).toContain("unsupported-source-copy");
    p.clips[0] = { ...source, hidden: true };
    p.sourceSpeech![0].segments[0] = {
      id: "hidden",
      start: 0,
      end: 10,
      text: "Short title",
    };
    expect(reasons(p)).toContain("unsupported-source-copy");
  });

  it("detects collisions with existing manually placed graphics without modifying them", () => {
    const p = project();
    p.clips.push(graphic({ id: "manual", locked: true }));
    const before = structuredClone(p);
    expect(reasons(p)).toContain("competing-text");
    expect(p).toEqual(before);
  });

  it("protects the actual editable caption layout and its changing position", () => {
    const p = project();
    p.transcript = [{ id: "caption", start: 1, end: 4, text: "Short title" }];
    p.captionAppearance = { position: "bottom", margin: 10, size: 6 };
    const g = graphic({
      graphic: normalizeGraphic({ ...graphic().graphic, y: 86 })!,
    });
    expect(reasons(p, g)).toContain("competing-text");
    p.captionAppearance.position = "top";
    expect(reasons(p, g)).not.toContain("competing-text");
  });

  it("does not confuse decimal values with ranges or borrow words outside the measured interval", () => {
    const p = project(
      evidence({
        observedText: [
          { id: "decimal", start: 1, end: 4, text: "1.5", confidence: 1 },
        ],
      })
    );
    expect(
      reasons(
        p,
        graphic({
          graphic: normalizeGraphic({ ...graphic().graphic, text: "1–5" })!,
        })
      )
    ).toContain("unsupported-source-copy");
    p.sourceSpeech![0].segments[0].words = [
      { text: "Short", start: 8, end: 8.2 },
      { text: "title", start: 8.2, end: 8.4 },
      { text: "A", start: 8.4, end: 8.6 },
    ];
    expect(reasons(p)).toContain("unsupported-source-copy");
    p.sourceSpeech![0].segments[0].words = undefined;
    expect(reasons(p)).toContain("unsupported-source-copy");
  });

  it("preserves a contiguous source phrase split across adjacent measured segments", () => {
    const p = project();
    p.sourceSpeech![0].segments = [
      { id: "first", start: 1, end: 2, text: "How to" },
      { id: "second", start: 2, end: 3, text: "make coffee" },
    ];
    const g = graphic({
      graphic: normalizeGraphic({
        ...graphic().graphic,
        text: "How to make coffee",
      })!,
    });
    expect(reasons(p, g)).not.toContain("unsupported-source-copy");
    p.sourceSpeech![0].segments[1].start = 2.5;
    expect(reasons(p, g)).toContain("unsupported-source-copy");
  });
});

describe("bounded auto-edit graphic decisions", () => {
  it.each([
    "",
    "cinematic",
    "Use a bold editorial style",
    "Non aggiungere testo",
    "Do not add a title",
    "Keep existing text clear",
  ])("does not invent a graphic request from %j", request => {
    expect(automaticGraphicIntent(request)).toBe("automatic");
  });
  it.each([
    "Add a title",
    "Inserisci un titolo leggibile",
    "Put an arrow by the product",
  ])(
    "recognizes a deliberate graphic request %j without authorizing source cover",
    request => {
      expect(automaticGraphicIntent(request)).toBe("requested");
    }
  );
  it("requires an explicit source replacement instruction for overlap permission", () => {
    expect(
      automaticGraphicIntent("Replace the existing label with this text")
    ).toBe("replace");
    expect(
      automaticGraphicIntent("Copri il testo originale con un titolo")
    ).toBe("replace");
  });

  it.each(["Ajoute un titre", "Añade un título", "Füge einen Titel hinzu"])(
    "recognizes a specific title request in %j",
    request => {
      expect(
        automaticGraphicIntent(request, normalizeGraphic({ kind: "text" })!)
      ).toBe("requested");
    }
  );

  it("scopes a human arrow request to the arrow, not unrelated commentary in that plan", () => {
    const p = project();
    p.sourceReviews![0].visualProtection = undefined;
    const arrow = graphic({
      id: "arrow",
      graphic: normalizeGraphic({
        kind: "arrow",
        x: 20,
        y: 20,
        animation: "none",
      })!,
    });
    const text = graphic({
      id: "claim",
      graphic: normalizeGraphic({
        ...graphic().graphic,
        text: "This treatment is clinically proven",
      })!,
    });
    const result = filterAutonomousGraphics(
      p,
      [operation(arrow), operation(text)],
      [asset],
      { request: "Put an arrow by the product" }
    );
    expect(result.changes.map(op => op.id)).toEqual(["arrow"]);
    expect(result.omitted.map(op => op.operationId)).toEqual(["claim"]);
    expect(result.warnings.map(op => op.operationId)).toEqual(["arrow"]);
  });

  it.each(["text", "callout"] as const)(
    "honors the exact requested %s title without allowing an unrelated same-kind claim",
    kind => {
      const p = project();
      p.sourceReviews![0].visualProtection = undefined;
      const policy = { request: 'Add a title "Workshop"' };
      const title = graphic({
        graphic: normalizeGraphic({
          ...graphic().graphic,
          kind,
          text: "Workshop",
        })!,
      });
      expect(
        filterAutonomousGraphics(p, [operation(title)], [asset], policy).changes
      ).toHaveLength(1);
      title.graphic!.text = "This treatment is clinically proven";
      expect(
        filterAutonomousGraphics(p, [operation(title)], [asset], policy).changes
      ).toHaveLength(0);
      title.graphic!.text = "Workshop";
      title.graphic!.secondaryText = "An unsolicited subtitle";
      expect(
        filterAutonomousGraphics(p, [operation(title)], [asset], policy).changes
      ).toHaveLength(0);
    }
  );

  it("limits a named text replacement to the matching observed source label", () => {
    const p = project(
      evidence({
        regions: [
          region(),
          {
            ...region(),
            id: "other",
            rect: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
          },
        ],
        observedText: [
          {
            id: "a",
            start: 0,
            end: 10,
            text: "Alpha",
            regionId: "prop",
            confidence: 1,
          },
          {
            id: "b",
            start: 0,
            end: 10,
            text: "Beta",
            regionId: "other",
            confidence: 1,
          },
        ],
      })
    );
    const policy = {
      request: "Replace the existing label Alpha with new text",
    };
    expect(
      filterAutonomousGraphics(p, [operation()], [asset], policy).changes
    ).toHaveLength(1);
    const wrong = graphic({
      graphic: normalizeGraphic({ ...graphic().graphic, y: 75 })!,
    });
    expect(
      filterAutonomousGraphics(p, [operation(wrong)], [asset], policy).changes
    ).toHaveLength(0);
  });

  it("omits an unknown unsolicited graphic, preserves sound and leaves signed inputs intact", () => {
    const p = project();
    p.sourceReviews![0].visualProtection = undefined;
    const soundAsset = { id: "sound", kind: "audio", duration: 1 } as Asset;
    const actions: EditOperation[] = [
      operation(),
      {
        ...operation(),
        id: "cue",
        type: "sound",
        start: 1,
        end: 2,
        parameters: { assetId: "sound" },
        targetClipIds: [source.id],
      },
    ];
    const before = structuredClone({ p, actions });
    const result = preflightAutonomousPlan(
      p,
      actions,
      [asset, soundAsset],
      undefined,
      "automatic"
    );
    expect(result.changes.map(op => op.id)).toEqual(["cue"]);
    expect(result.omitted[0].issues[0].reason).toBe("unknown-source-layout");
    expect(autonomousGraphicReceipt(result)).toContain("Skipped 1 graphic");
    expect({ p, actions }).toEqual(before);
  });

  it("keeps explicitly requested graphics with unknown coverage and reports uncertainty", () => {
    const p = project();
    p.sourceReviews![0].visualProtection = undefined;
    const result = filterAutonomousGraphics(
      p,
      [operation()],
      [asset],
      "requested"
    );
    expect(result.changes).toHaveLength(1);
    expect(result.omitted).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(autonomousGraphicReceipt(result)).toContain("could not be verified");
  });

  it("still omits known source occlusion for requested titles, but honors deliberate replacement", () => {
    const p = project(evidence({ regions: [region()] }));
    expect(
      filterAutonomousGraphics(p, [operation()], [asset], "requested").changes
    ).toEqual([]);
    expect(
      filterAutonomousGraphics(p, [operation()], [asset], "replace").changes
    ).toHaveLength(1);
    p.sourceReviews![0].visualProtection!.regions[0].kind = "face";
    expect(
      filterAutonomousGraphics(p, [operation()], [asset], "replace").changes
    ).toHaveLength(0);
  });

  it("checks final source/graphic timing after ripple cuts, without touching manual graphics", () => {
    const p = project(evidence({ regions: [region(5, 6)] }));
    p.clips.push(graphic({ id: "manual", start: 8, duration: 2, outPoint: 2 }));
    const cut: EditOperation = {
      ...operation(),
      id: "cut",
      type: "silence",
      start: 0,
      end: 2,
      parameters: {},
      targetClipIds: [source.id],
    };
    const result = filterAutonomousGraphics(
      p,
      [operation(graphic({ start: 5, duration: 2, outPoint: 2 })), cut],
      [asset]
    );
    expect(result.omitted.map(item => item.operationId)).toEqual(["card"]);
    expect(result.changes.map(item => item.id)).toEqual(["cut"]);
    expect(p.clips.some(clip => clip.id === "manual")).toBe(true);
  });

  it("rechecks retained graphics after an omitted update restores a manual graphic", () => {
    const p = project(evidence({ regions: [{ ...region(), kind: "face" }] }));
    const manual = graphic({
      id: "manual",
      graphic: normalizeGraphic({ ...graphic().graphic, y: 15 })!,
    });
    p.clips.push(manual);
    const update: EditOperation = {
      ...operation(),
      id: "move-manual",
      targetClipIds: ["manual"],
      parameters: { graphicMode: "update", graphic: graphic().graphic },
    };
    const title = operation(
      graphic({
        id: "new-title",
        graphic: normalizeGraphic({ ...graphic().graphic, y: 15 })!,
      })
    );
    const result = preflightAutonomousPlan(
      p,
      [update, title],
      [asset],
      undefined,
      "automatic"
    );
    expect(result.changes).toEqual([]);
    expect(result.omitted.map(item => item.operationId).sort()).toEqual([
      "move-manual",
      "new-title",
    ]);
    expect(p.clips.find(clip => clip.id === "manual")).toEqual(manual);
  });

  it("never reports a bounded scan as clear when the complete scan is too large", () => {
    const p = project();
    p.duration = 1000;
    p.clips = [];
    const result = filterAutonomousGraphics(
      p,
      [operation(graphic({ duration: 900, outPoint: 900 }))],
      []
    );
    expect(result.omitted[0].issues[0].reason).toBe("unknown-source-layout");
  });
});
