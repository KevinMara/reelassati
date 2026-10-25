import { describe, expect, it } from "vitest";
import { createEmptyWorkspace, type EditProject } from "@contracts/workspace";
import {
  autonomousPlanCacheKey,
  createAutonomousPlanCache,
  type AutonomousPlanCacheInput,
  type AutonomousPlanResult,
} from "./autonomous-plan-cache";
import { preflightAutonomousPlan } from "./autonomous-execution";

function fixture() {
  const workspace = createEmptyWorkspace("owner@example.test");
  const input: AutonomousPlanCacheInput = {
    scope: {
      ownerId: "owner",
      ownerEmail: workspace.profile.email,
      brandId: "brand",
    },
    project: {
      id: "project",
      title: "Original",
      platform: "instagram",
      duration: 4,
      aspectRatio: "9:16",
      frameRate: 30,
      playhead: 0,
      activeAssetId: "source",
      updatedAt: "before",
      clips: [
        {
          id: "clip",
          assetId: "source",
          track: "video",
          start: 0,
          duration: 4,
          inPoint: 0,
          outPoint: 4,
        },
      ],
      transcript: [],
      proposedChanges: [],
      sourceSpeech: [
        {
          assetId: "source",
          segments: [{ id: "word", start: 0, end: 1, text: "Observed speech" }],
        },
      ],
      sourceReviews: [
        {
          assetId: "source",
          reviewedAt: "before",
          summary: "Observed source",
          captions: "absent",
          audio: "present",
        },
      ],
      revisions: [],
      revisionIndex: 0,
    } as unknown as EditProject,
    assets: [
      {
        id: "source",
        kind: "video",
        name: "Source.mp4",
        size: 100,
        duration: 4,
        url: "/source.mp4",
        contentType: "video/mp4",
        status: "ready",
        createdAt: "before",
      },
    ],
    brandKit: workspace.brandKit,
    savedReports: [],
    contentLanguage: "en",
    uiLocale: "it",
    options: {
      model: "moonshotai/kimi-k3",
      effort: "max",
      stock: true,
      style: "Natural",
      referenceBrief: "Original reference",
      durationMode: "none",
      minimumDuration: "2",
      maximumDuration: "4",
      automaticDuration: true,
      captions: true,
      images: 0,
      videos: 0,
    },
  };
  const result: AutonomousPlanResult = {
    summary: "Signed plan",
    changes: [
      {
        id: "cue",
        type: "sound",
        label: "Cue",
        reason: "Observed completion",
        start: 2,
        end: 3,
        confidence: 1,
        intensity: "light",
        targetClipIds: [],
        status: "proposed",
        parameters: { assetId: "catalog:missing", sourceIn: 0 },
      },
    ],
    stockMedia: [],
    provenance: {
      recordId: "signed-plan",
      origin: "ai-assisted",
      operation: "edit-planning",
      provider: "Provider",
      model: "moonshotai/kimi-k3",
      generatedAt: "before",
      policyVersion: "policy",
      marking: {
        scheme: "reelassati-provenance-v1",
        method: "signed-record+sha256-fingerprint",
        status: "verified",
      },
    },
  };
  result.changes[0].provenance = result.provenance;
  const working = structuredClone(input.project);
  working.sourceReviews![0].reviewedAt = "prepared-once";
  return { input, result, working };
}

describe("manual same-input plan recovery", () => {
  it("retains the completed signed response and prepared evidence after local preflight fails", () => {
    const { input, result, working } = fixture();
    const cache = createAutonomousPlanCache();
    const key = autonomousPlanCacheKey(input);
    cache.write(key, working, result);
    expect(() =>
      preflightAutonomousPlan(working, result.changes, input.assets)
    ).toThrow();
    const retry = cache.read(autonomousPlanCacheKey(structuredClone(input)));
    expect(retry?.working.sourceReviews?.[0].reviewedAt).toBe("prepared-once");
    expect(retry?.result).toEqual(result);
    expect(retry?.result.changes[0].provenance?.recordId).toBe("signed-plan");
  });

  it("isolates the signed recommendation from source objects and execution copies", () => {
    const { input, result, working } = fixture();
    const cache = createAutonomousPlanCache();
    const key = autonomousPlanCacheKey(input);
    cache.write(key, working, result);
    result.changes[0].end = 100;
    working.sourceReviews![0].summary = "Mutated after capture";
    const retry = cache.read(key)!;
    retry.result.changes[0].parameters!.assetId = "resolved-upload";
    retry.result.changes[0].end = 2.5;
    retry.working.sourceSpeech![0].segments[0].text =
      "Mutated during execution";
    const next = cache.read(key)!;
    expect(next.result.changes[0]).toMatchObject({
      end: 3,
      parameters: { assetId: "catalog:missing" },
      provenance: { recordId: "signed-plan" },
    });
    expect(next.working.sourceReviews![0].summary).toBe("Observed source");
    expect(next.working.sourceSpeech![0].segments[0].text).toBe(
      "Observed speech"
    );
  });

  const changes: Array<[string, (input: AutonomousPlanCacheInput) => void]> = [
    [
      "owner identity",
      i => {
        i.scope.ownerId = "other";
      },
    ],
    [
      "owner email",
      i => {
        i.scope.ownerEmail = "other@example.test";
      },
    ],
    [
      "brand",
      i => {
        i.scope.brandId = "other";
      },
    ],
    [
      "project",
      i => {
        i.project.id = "other";
      },
    ],
    [
      "timeline",
      i => {
        i.project.clips[0].start = 1;
      },
    ],
    [
      "history",
      i => {
        i.project.revisionIndex = 1;
      },
    ],
    [
      "source bytes",
      i => {
        i.assets[0].size = 101;
      },
    ],
    [
      "source duration",
      i => {
        i.assets[0].duration = 3;
      },
    ],
    [
      "source location",
      i => {
        i.assets[0].url = "/replaced.mp4";
      },
    ],
    [
      "library",
      i => {
        i.assets.push({ ...i.assets[0], id: "other" });
      },
    ],
    [
      "observations",
      i => {
        i.project.sourceReviews![0].summary = "Different observation";
      },
    ],
    [
      "speech evidence",
      i => {
        i.project.sourceSpeech![0].segments[0].text = "Different words";
      },
    ],
    [
      "saved evidence",
      i => {
        i.savedReports = undefined;
      },
    ],
    [
      "brand direction",
      i => {
        i.brandKit.voice = "Different voice";
      },
    ],
    [
      "content language",
      i => {
        i.contentLanguage = "fr";
      },
    ],
    [
      "interface language",
      i => {
        i.uiLocale = "de";
      },
    ],
    ...[
      "model",
      "effort",
      "style",
      "referenceBrief",
      "durationMode",
      "minimumDuration",
      "maximumDuration",
    ].map(
      key =>
        [
          key,
          (i: AutonomousPlanCacheInput) => {
            i.options[key] = "changed";
          },
        ] as [string, (input: AutonomousPlanCacheInput) => void]
    ),
    ...["stock", "automaticDuration", "captions"].map(
      key =>
        [
          key,
          (i: AutonomousPlanCacheInput) => {
            i.options[key] = false;
          },
        ] as [string, (input: AutonomousPlanCacheInput) => void]
    ),
    ...["images", "videos"].map(
      key =>
        [
          key,
          (i: AutonomousPlanCacheInput) => {
            i.options[key] = 1;
          },
        ] as [string, (input: AutonomousPlanCacheInput) => void]
    ),
  ];
  it.each(changes)(
    "invalidates and discards reuse after a change to %s",
    (_, change) => {
      const { input, result, working } = fixture();
      const cache = createAutonomousPlanCache();
      const originalKey = autonomousPlanCacheKey(input);
      cache.write(originalKey, working, result);
      change(input);
      expect(cache.read(autonomousPlanCacheKey(input))).toBeUndefined();
      expect(cache.read(originalKey)).toBeUndefined();
    }
  );

  it("ignores navigation while explicit clearing ends recovery", () => {
    const { input, result, working } = fixture();
    const cache = createAutonomousPlanCache();
    const key = autonomousPlanCacheKey(input);
    cache.write(key, working, result);
    input.project.playhead = 2;
    input.project.activeAssetId = "another-preview";
    input.project.updatedAt = "later";
    expect(cache.read(autonomousPlanCacheKey(input))?.result.summary).toBe(
      "Signed plan"
    );
    cache.clear();
    expect(cache.read(key)).toBeUndefined();
  });
});
