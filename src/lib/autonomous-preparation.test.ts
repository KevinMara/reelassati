import { describe, expect, it, vi } from "vitest";
import type { Asset, EditOperation, EditProject } from "@contracts/workspace";
import { normalizeGraphic } from "@contracts/motion-graphics";
import {
  preflightAutonomousPlan,
  executeAutonomousPlan,
} from "./autonomous-execution";
import {
  checkpointAnalyzerReport,
  type SavedAnalyzerReport,
} from "@contracts/analyzer-report";
import {
  createAutonomousPreparationCache,
  prepareAutonomousSources,
  findSavedAutonomousReview,
  hasCompleteAutonomousLayout,
} from "./autonomous-preparation";
import { autonomousSourceReviewCost } from "./autonomous-credit-estimate";
import { AI_CREDIT_COSTS, timedCreditCost } from "@contracts/billing";

const source = {
  id: "source",
  kind: "video",
  size: 100,
  duration: 4,
  contentType: "video/mp4",
} as Asset;
const project = {
  platform: "instagram",
  clips: [
    {
      id: "clip",
      assetId: "source",
      start: 0,
      duration: 4,
      inPoint: 0,
      outPoint: 4,
      speed: 1,
    },
  ],
  transcript: [],
} as unknown as EditProject;
function fixture() {
  return {
    project,
    sources: [source],
    captions: true,
    context: "owner/brand/project/en",
    cache: createAutonomousPreparationCache(),
    checkpoint: vi.fn(),
    review: vi.fn(
      async () =>
        ({
          summary: "Observed source",
          review: { captions: "absent", audio: "present" },
          retention: [{ start: 0, end: 4, score: 50, note: "Observed" }],
        }) as never
    ),
    transcribe: vi.fn(
      async () =>
        ({
          transcript: "Actual speech",
          segments: [{ id: "word", start: 0, end: 1, text: "Actual speech" }],
        }) as never
    ),
  };
}

function savedReport(): SavedAnalyzerReport {
  const insight = {
    start: 0,
    end: 4,
    role: "hook" as const,
    roleReason: "The opening poses a concrete question",
    label: "Opening question",
    attention: 70,
    stimulation: 40,
    processingLoad: 30,
    clarity: 80,
    confidence: 0.8,
    visualEvidence: "A readable question appears",
    audioEvidence: "Audio was not verified",
    strength: "The question is specific",
    improvement: "Preserve its readable hold",
    rationale: "The topic is clear immediately",
  };
  return {
    assetId: source.id,
    duration: 4,
    platform: "instagram",
    createdAt: "2026-10-23T16:00:00Z",
    result: {
      schemaVersion: "video-analysis-v2",
      summary: "An observed opening question",
      hook: { score: 70, note: "Question visible" },
      pacing: { score: 70, note: "Readable hold" },
      insights: [insight],
      structure: ["hook", "core", "proof", "payoff", "cta"].map(role => ({
        role,
        status: role === "hook" ? "present" : "absent",
        note: "Observed source function",
      })) as SavedAnalyzerReport["result"]["structure"],
      review: {
        captions: "present",
        captionNote: "Words burned into the frames",
        audio: "unknown",
        audioNote: "Audio was not verified",
        ending: null,
        visualProtection: {
          version: 1,
          sourceDuration: 4,
          coverage: "complete",
          reviewedRanges: [{ start: 0, end: 4 }],
          regions: [],
          observedText: [],
        },
      },
      retention: [],
      changes: [],
      provenance: { origin: "ai-assisted" } as never,
    },
  };
}

describe("saved paid review reuse", () => {
  it("turns a formerly omitted source-grounded graphic into an executable native layer after one measured layout refresh", async () => {
    const input = fixture(),
      legacy = savedReport(),
      fresh = savedReport();
    legacy.result.review!.visualProtection = undefined;
    fresh.result.review!.visualProtection!.regions = [
      {
        id: "face",
        kind: "face",
        start: 0,
        end: 4,
        rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        confidence: 0.95,
      },
    ];
    const media = {
      ...source,
      width: 1000,
      height: 1778,
      status: "ready" as const,
    };
    const sourceSpeech = [
      {
        assetId: source.id,
        segments: [
          {
            id: "phrase",
            start: 1,
            end: 2,
            text: "Actual speech",
            words: [
              { text: "Actual", start: 1.1, end: 1.4 },
              { text: "speech", start: 1.5, end: 1.9 },
            ],
          },
        ],
      },
    ];
    const original = {
      ...project,
      id: "edit",
      duration: 4,
      aspectRatio: "9:16",
      playhead: 0,
      clips: [
        { ...project.clips[0], track: "video", locked: false, label: "Source" },
      ],
      sourceSpeech,
      proposedChanges: [],
      qualitySignals: [],
      revisions: [],
      sourceReviews: [
        {
          ...legacy.result.review,
          assetId: source.id,
          reviewedAt: legacy.createdAt,
          summary: "",
          moments: [],
        },
      ],
    } as EditProject;
    const graphic: EditOperation = {
      id: "grounded-callout",
      type: "graphic",
      start: 1,
      end: 3,
      targetClipIds: ["clip"],
      label: "Measured explanation",
      reason: "Emphasize the actual source words",
      confidence: 1,
      intensity: "balanced",
      status: "proposed",
      parameters: {
        graphic: normalizeGraphic({
          kind: "callout",
          text: "Actual speech",
          size: 4,
          x: 75,
          y: 65,
          animation: "none",
          color: "#FFFFFF",
          background: "#111111",
        })!,
      },
    };
    expect(
      preflightAutonomousPlan(
        original,
        [graphic],
        [media],
        undefined,
        "automatic"
      ).omitted[0].issues.map(issue => issue.reason)
    ).toContain("unknown-source-layout");
    input.review.mockResolvedValue(fresh.result as never);
    const prepared = await prepareAutonomousSources({
      ...input,
      project: original,
      sources: [media],
      savedReports: [legacy],
      speechTiming: true,
      runId: "explicit-run",
    });
    const review = preflightAutonomousPlan(
      prepared.working,
      [graphic],
      [media],
      undefined,
      "automatic"
    );
    expect(input.review).toHaveBeenCalledTimes(1);
    expect(input.transcribe).not.toHaveBeenCalled();
    expect(review.omitted).toEqual([]);
    const result = executeAutonomousPlan(prepared.working, review.changes, [
      media,
    ]);
    expect(result.clips.find(clip => clip.graphic)?.graphic?.text).toBe(
      "Actual speech"
    );
    expect(result.sourceSpeech).toEqual(sourceSpeech);
    expect(result.transcript).toEqual([]);
  });

  it.each(["missing", "partial", "malformed"] as const)(
    "refreshes %s spatial evidence once and prices that same preparation",
    async quality => {
      const input = fixture();
      const legacy = savedReport();
      if (quality === "missing")
        legacy.result.review!.visualProtection = undefined;
      if (quality === "partial")
        legacy.result.review!.visualProtection!.coverage = "partial";
      if (quality === "malformed")
        legacy.result.review!.visualProtection!.reviewedRanges[0].end = 5;
      expect(
        findSavedAutonomousReview(source, project.platform, [legacy])
      ).toBeDefined();
      expect(
        findSavedAutonomousReview(source, project.platform, [legacy], true)
      ).toBeUndefined();
      expect(
        autonomousSourceReviewCost([source], project.platform, [legacy])
      ).toBe(
        timedCreditCost(source.duration, AI_CREDIT_COSTS.videoAnalysisPerMinute)
      );
      const complete = savedReport();
      input.review.mockResolvedValue(complete.result as never);
      const prepared = await prepareAutonomousSources({
        ...input,
        savedReports: [legacy],
        runId: "manual-run",
      });
      expect(input.review).toHaveBeenCalledTimes(1);
      expect(prepared.analysis[0].visualProtection?.coverage).toBe("complete");
      await prepareAutonomousSources({
        ...input,
        savedReports: [legacy],
        runId: "manual-run",
      });
      expect(input.review).toHaveBeenCalledTimes(1);
      expect(
        autonomousSourceReviewCost(
          [source, { ...source, kind: "audio" }],
          project.platform,
          [complete]
        )
      ).toBe(0);
    }
  );

  it("keeps a newly reviewed unknown layout truthful without another purchase in that run", async () => {
    const input = fixture();
    const legacy = savedReport();
    legacy.result.review!.visualProtection = undefined;
    const first = await prepareAutonomousSources({
      ...input,
      savedReports: [legacy],
      runId: "one",
    });
    const second = await prepareAutonomousSources({
      ...input,
      savedReports: [legacy],
      runId: "one",
    });
    expect(input.review).toHaveBeenCalledTimes(1);
    expect(first.analysis[0].visualProtection?.coverage).toBe("unknown");
    expect(second.analysis[0].visualProtection?.coverage).toBe("unknown");
    expect(
      hasCompleteAutonomousLayout([...input.cache.reviews.values()][0], source)
    ).toBe(false);
    expect(
      autonomousSourceReviewCost([source], project.platform, [legacy])
    ).toBeGreaterThan(0);
  });

  it("retains a failed refresh within the run, then permits only a new explicit run to try again", async () => {
    const input = fixture();
    const legacy = savedReport();
    legacy.result.review!.visualProtection = undefined;
    input.review.mockRejectedValueOnce(new Error("Layout review unavailable"));
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(
        prepareAutonomousSources({
          ...input,
          savedReports: [legacy],
          runId: "one",
        })
      ).rejects.toThrow("Layout review unavailable");
    expect(input.review).toHaveBeenCalledTimes(1);
    expect(input.transcribe).not.toHaveBeenCalled();
    input.review.mockResolvedValue(savedReport().result as never);
    await prepareAutonomousSources({
      ...input,
      savedReports: [legacy],
      runId: "explicit-new-run",
    });
    expect(input.review).toHaveBeenCalledTimes(2);
  });

  it("reuses verified source speech despite a stale absent-audio note without inventing captions", async () => {
    const input = fixture();
    const report = savedReport();
    report.result.review!.audio = "absent";
    report.result.review!.audioNote = "Audio was not supplied";
    const speech = [
      {
        assetId: source.id,
        segments: [
          {
            id: "speech",
            start: 1,
            end: 2,
            text: "Measured words",
            words: [
              { text: "Measured", start: 1, end: 1.4 },
              { text: "words", start: 1.5, end: 2 },
            ],
          },
        ],
      },
    ];
    const result = await prepareAutonomousSources({
      ...input,
      project: { ...project, sourceSpeech: speech },
      savedReports: [report],
      speechTiming: true,
    });
    expect(input.review).not.toHaveBeenCalled();
    expect(input.transcribe).not.toHaveBeenCalled();
    expect(result.working.sourceSpeech).toEqual(speech);
    expect(result.working.transcript).toEqual([]);
    expect(result.working.sourceReviews?.[0]).toMatchObject({
      audio: "present",
      audioNote:
        "Timed source speech is available. Music and noise were not assessed.",
    });
    report.result.review!.audio = "present";
    report.result.review!.audioNote = "Speech over a quiet recorded music bed";
    const observed = await prepareAutonomousSources({
      ...input,
      project: { ...project, sourceSpeech: speech },
      savedReports: [{ ...report, createdAt: "2026-11-11T00:00:00Z" }],
      speechTiming: true,
    });
    expect(observed.working.sourceReviews?.[0].audioNote).toBe(
      "Speech over a quiet recorded music bed"
    );
  });

  it("reuses every paid source review after reopening an edit with more than six videos", async () => {
    const sources = Array.from({ length: 9 }, (_, index) => ({
      ...source,
      id: `source-${index}`,
    }));
    const edit = {
      ...project,
      clips: sources.map((asset, index) => ({
        ...project.clips[0],
        id: `clip-${index}`,
        assetId: asset.id,
        start: index * 4,
      })),
    };
    let reports: SavedAnalyzerReport[] = [];
    const initial = fixture();
    initial.transcribe.mockRejectedValueOnce(new Error("Speech unavailable"));
    const review = vi.fn(async (asset: Asset) => {
      const report = savedReport();
      report.assetId = asset.id;
      report.result.review!.captions = "absent";
      report.result.review!.audio = "present";
      report.result.insights[0].visualEvidence = `Observed evidence for ${asset.id}`;
      reports = checkpointAnalyzerReport(reports, report);
      return report.result;
    });
    await expect(
      prepareAutonomousSources({
        ...initial,
        sources,
        project: edit,
        review,
      })
    ).rejects.toThrow("Speech unavailable");
    expect(review).toHaveBeenCalledTimes(sources.length);
    expect(reports).toHaveLength(sources.length);

    const reopened = fixture();
    const restored = await prepareAutonomousSources({
      ...reopened,
      sources,
      project: edit,
      savedReports: JSON.parse(JSON.stringify(reports)),
    });
    expect(reopened.review).not.toHaveBeenCalled();
    expect(reopened.transcribe).toHaveBeenCalledTimes(sources.length);
    expect(restored.analysis).toHaveLength(sources.length);
    for (const asset of sources) {
      expect(
        restored.analysis.find(item => item.assetId === asset.id)
          ?.observations[0].visualEvidence
      ).toBe(`Observed evidence for ${asset.id}`);
      expect(
        reports.find(report => report.assetId === asset.id)?.result.provenance
      ).toEqual(savedReport().result.provenance);
    }
  });

  it("rejects an oversized review without evicting already saved evidence", () => {
    const existing = Array.from({ length: 9 }, (_, index) => ({
      ...savedReport(),
      assetId: `saved-${index}`,
    }));
    const oversized = savedReport();
    oversized.result.summary = "x".repeat(250_001);
    expect(() => checkpointAnalyzerReport(existing, oversized)).toThrow(
      "could not be saved"
    );
    expect(existing).toHaveLength(9);
    for (const report of existing)
      expect(
        findSavedAutonomousReview(
          { ...source, id: report.assetId },
          project.platform,
          existing
        )
      ).toBeDefined();
  });

  it("restores a paid checkpoint after speech failure and a fresh editor session", async () => {
    const input = fixture();
    let reports: SavedAnalyzerReport[] = [];
    const report = savedReport();
    report.result.review!.captions = "absent";
    report.result.review!.audio = "present";
    input.review.mockImplementation(async () => {
      reports = checkpointAnalyzerReport(reports, report);
      return report.result as never;
    });
    input.transcribe.mockRejectedValueOnce(new Error("Speech unavailable"));
    await expect(prepareAutonomousSources(input)).rejects.toThrow(
      "Speech unavailable"
    );
    const reopened = fixture();
    const restored = await prepareAutonomousSources({
      ...reopened,
      savedReports: JSON.parse(JSON.stringify(reports)),
    });
    expect(input.review).toHaveBeenCalledTimes(1);
    expect(reopened.review).not.toHaveBeenCalled();
    expect(reopened.transcribe).toHaveBeenCalledTimes(1);
    expect(restored.analysis[0].observations[0].visualEvidence).toBe(
      report.result.insights[0].visualEvidence
    );
    expect(reports[0].result.provenance).toEqual(report.result.provenance);
    expect(project.transcript).toEqual([]);
  });
  it("replaces only the same source/platform checkpoint and rejects incomplete evidence", () => {
    const report = savedReport();
    const otherSource = { ...report, assetId: "other-source" };
    const otherPlatform = { ...report, platform: "youtube" };
    const newer = { ...report, createdAt: "2026-11-01T18:00:00Z" };
    const saved = checkpointAnalyzerReport(
      [report, otherSource, otherPlatform],
      newer
    );
    expect(saved.map(r => [r.assetId, r.platform, r.createdAt])).toEqual([
      [newer.assetId, newer.platform, newer.createdAt],
      [otherSource.assetId, otherSource.platform, otherSource.createdAt],
      [otherPlatform.assetId, otherPlatform.platform, otherPlatform.createdAt],
    ]);
    expect(() =>
      checkpointAnalyzerReport(saved, {
        ...newer,
        result: { ...newer.result, insights: [] },
      })
    ).toThrow("could not be saved");
    expect(saved).toHaveLength(3);
  });
  it("transcribes dialogue but never a built-in check sound or generated music during auto-edit", async () => {
    const input = fixture();
    const effect = {
      ...source,
      id: "check",
      kind: "audio",
      duration: 0.26227083333333334,
      variantGroupId: "builtin-audio:zen-check",
    } as Asset;
    const music = {
      ...source,
      id: "music",
      kind: "audio",
      provenance: { operation: "audio-generation" },
    } as Asset;
    input.sources = [effect, music, source];
    input.project = {
      ...project,
      clips: [
        ...project.clips,
        ...[effect, music].map(asset => ({
          ...project.clips[0],
          id: asset.id,
          assetId: asset.id,
          track: "audio" as const,
          duration: asset.duration!,
        })),
      ],
    };
    input.transcribe.mockImplementation(async (asset?: Asset) => {
      if (asset?.id !== source.id)
        throw new Error("Sound effects must not be transcribed");
      return {
        transcript: "Actual speech",
        segments: [{ id: "word", text: "Actual speech", start: 0, end: 1 }],
      } as never;
    });
    const result = await prepareAutonomousSources({
      ...input,
      speechTiming: true,
    });
    expect(input.transcribe).toHaveBeenCalledTimes(1);
    expect(input.transcribe).toHaveBeenCalledWith(source);
    expect(result.working.clips).toEqual(input.project.clips);
    expect(result.working.sourceSpeech?.map(item => item.assetId)).toEqual([
      source.id,
    ]);
  });
  it("still transcribes a short uploaded voice without guessing its role from duration or filename", async () => {
    const input = fixture();
    const voice = {
      ...source,
      id: "voice",
      name: "ping.wav",
      kind: "audio",
      duration: 0.26,
    } as Asset;
    input.sources = [voice];
    input.project = {
      ...project,
      clips: [{ ...project.clips[0], assetId: voice.id, track: "audio" }],
    };
    await prepareAutonomousSources({ ...input, speechTiming: true });
    expect(input.transcribe).toHaveBeenCalledWith(voice);
  });
  it("upgrades an open editor's legacy cache from a new saved spatial review without inference", async () => {
    const input = fixture(),
      old = savedReport();
    old.result.review!.visualProtection = undefined;
    input.review.mockResolvedValue(old.result as never);
    const legacy = await prepareAutonomousSources({
      ...input,
      savedReports: [old],
    });
    expect(legacy.analysis[0].visualProtection?.coverage).toBe("unknown");
    const fresh = structuredClone(old);
    fresh.createdAt = "2026-10-26T10:00:00Z";
    fresh.result.review!.visualProtection = {
      version: 1,
      sourceDuration: 4,
      coverage: "complete",
      reviewedRanges: [{ start: 0, end: 4 }],
      regions: [],
      observedText: [],
    };
    const updated = await prepareAutonomousSources({
      ...input,
      savedReports: [old, fresh],
    });
    expect(updated.analysis[0].visualProtection?.coverage).toBe("complete");
    expect(input.review).toHaveBeenCalledTimes(1);
    expect(input.transcribe).not.toHaveBeenCalled();
  });
  it("prepares the exact source from its complete saved review without another provider call", async () => {
    const input = fixture();
    const report = savedReport();
    input.review.mockRejectedValue(
      new Error("A duplicate purchase must not occur")
    );
    const result = await prepareAutonomousSources({
      ...input,
      savedReports: [report],
    });
    expect(input.review).not.toHaveBeenCalled();
    expect(input.transcribe).not.toHaveBeenCalled();
    expect(result.analysis[0].observations).toEqual([
      {
        start: 0,
        end: 4,
        confidence: 0.8,
        visualEvidence: report.result.insights[0].visualEvidence,
        audioEvidence: report.result.insights[0].audioEvidence,
      },
    ]);
    expect(result.analysis[0].visualProtection?.coverage).toBe("complete");
    expect(JSON.stringify(result.analysis)).not.toContain(
      report.result.insights[0].improvement
    );
    expect(JSON.stringify(result.analysis)).not.toContain(
      report.result.insights[0].rationale
    );
    expect(result.working.sourceReviews?.[0]).toMatchObject({
      assetId: source.id,
      captions: "present",
      audio: "unknown",
    });
    result.analysis[0].observations[0].visualEvidence = "Edited local note";
    expect(report.result.insights[0].label).toBe("Opening question");
  });
  it.each([
    "source",
    "duration",
    "platform",
    "schema",
    "coverage",
    "story",
    "review",
  ])(
    "does not bypass preparation for mismatched or incomplete saved %s",
    async mismatch => {
      const input = fixture();
      const report = savedReport();
      if (mismatch === "source") report.assetId = "another-source";
      if (mismatch === "duration") report.duration = 5;
      if (mismatch === "platform") report.platform = "youtube";
      if (mismatch === "schema")
        report.result.schemaVersion = "legacy" as never;
      if (mismatch === "coverage") report.result.insights[0].end = 3;
      if (mismatch === "story") report.result.structure = [];
      if (mismatch === "review") report.result.review = undefined;
      await prepareAutonomousSources({ ...input, savedReports: [report] });
      expect(input.review).toHaveBeenCalledTimes(1);
    }
  );
  it("accepts native metadata precision and still buys missing speech preparation only", async () => {
    const input = fixture();
    const report = savedReport();
    report.result.review = {
      ...report.result.review!,
      captions: "absent",
      audio: "present",
    };
    expect(
      findSavedAutonomousReview(
        { ...source, duration: 4.000000001 },
        project.platform,
        [report]
      )
    ).toBeDefined();
    await prepareAutonomousSources({ ...input, savedReports: [report] });
    expect(input.review).not.toHaveBeenCalled();
    expect(input.transcribe).toHaveBeenCalledTimes(1);
  });
});
describe("auto-edit source preparation recovery", () => {
  it("retains actual picture/audio observations instead of only editorial rationale", async () => {
    const input = fixture();
    const observed = {
      start: 0,
      end: 4,
      role: "proof",
      visualEvidence: "A working prototype opens",
      audioEvidence: "The speaker explains the result",
      rationale: "A demonstration supports the claim",
    };
    input.review.mockResolvedValue({
      summary: "Observed",
      review: { captions: "absent", audio: "present" },
      retention: [{ start: 0, end: 4, note: observed.rationale }],
      insights: [observed],
    } as never);
    const result = await prepareAutonomousSources(input);
    expect(result.analysis[0].observations).toEqual([
      {
        start: 0,
        end: 4,
        confidence: null,
        visualEvidence: observed.visualEvidence,
        audioEvidence: observed.audioEvidence,
      },
    ]);
    expect(result.working.sourceReviews?.[0].moments[0].note).toContain(
      observed.visualEvidence
    );
    expect(result.working.sourceReviews?.[0].moments[0].note).toContain(
      observed.audioEvidence
    );
    expect(result.working.sourceReviews?.[0].moments[0].note).not.toContain(
      observed.rationale
    );
  });
  it("prepares missing speech from another source without replacing existing captions", async () => {
    const input = fixture();
    const existing = {
      id: "kept",
      sourceClipId: "other-clip",
      start: 5,
      end: 6,
      text: "Keep my wording",
    };
    input.project = {
      ...project,
      clips: [
        ...project.clips,
        { ...project.clips[0], id: "other-clip", assetId: "other", start: 5 },
      ],
      transcript: [existing],
    };
    const result = await prepareAutonomousSources(input);
    expect(input.transcribe).toHaveBeenCalledTimes(1);
    expect(result.working.transcript).toContainEqual(existing);
    expect(result.working.transcript).toContainEqual(
      expect.objectContaining({ sourceClipId: "clip", text: "Actual speech" })
    );
  });
  it("keeps authored captions on one occurrence while captioning another occurrence of the same source", async () => {
    const input = fixture();
    input.project = {
      ...project,
      clips: [
        ...project.clips,
        { ...project.clips[0], id: "repeat", start: 5 },
      ],
      transcript: [
        {
          id: "kept",
          sourceClipId: "clip",
          start: 0,
          end: 1,
          text: "Authored",
        },
      ],
    };
    const result = await prepareAutonomousSources(input);
    expect(result.working.transcript.map(s => s.sourceClipId)).toEqual([
      "clip",
      "repeat",
    ]);
  });
  it("does not transcribe muted media", async () => {
    const input = fixture();
    input.project = {
      ...project,
      clips: project.clips.map(c => ({ ...c, muted: true })),
    };
    await prepareAutonomousSources(input);
    expect(input.transcribe).not.toHaveBeenCalled();
  });
  it("reviews all pictures before transcribing audio, independent of Library order", async () => {
    const input = fixture();
    const audio = { ...source, id: "sound", kind: "audio" } as Asset;
    input.sources = [audio, source];
    input.project = {
      ...project,
      clips: [
        {
          ...project.clips[0],
          id: "audio",
          assetId: "sound",
          track: "audio",
          linkId: "av",
        },
        { ...project.clips[0], linkId: "av" },
      ],
    };
    input.review.mockResolvedValue({
      summary: "Already captioned",
      review: { captions: "present", audio: "present" },
      retention: [],
    } as never);
    await prepareAutonomousSources(input);
    expect(input.transcribe).not.toHaveBeenCalled();
  });
  it("reuses completed review and transcription after a later planning failure", async () => {
    const input = fixture();
    const first = await prepareAutonomousSources(input);
    const second = await prepareAutonomousSources(input);
    expect(input.review).toHaveBeenCalledTimes(1);
    expect(input.transcribe).toHaveBeenCalledTimes(1);
    expect(first.working.transcript).toEqual(second.working.transcript);
    expect(second.working.transcript).toHaveLength(1);
    expect(project.transcript).toEqual([]);
  });
  it("does not repeat a completed review when speech preparation fails", async () => {
    const input = fixture();
    input.transcribe.mockRejectedValueOnce(new Error("Speech unavailable"));
    await expect(prepareAutonomousSources(input)).rejects.toThrow(
      "Speech unavailable"
    );
    await prepareAutonomousSources(input);
    expect(input.review).toHaveBeenCalledTimes(1);
    expect(input.transcribe).toHaveBeenCalledTimes(2);
  });
  it("never reuses another workspace, language, platform or changed source", async () => {
    const input = fixture();
    await prepareAutonomousSources(input);
    await prepareAutonomousSources({
      ...input,
      context: "other/brand/project/en",
    });
    await prepareAutonomousSources({
      ...input,
      sources: [{ ...source, size: 101 }],
    });
    await prepareAutonomousSources({
      ...input,
      project: { ...project, platform: "tiktok" },
    });
    expect(input.review).toHaveBeenCalledTimes(4);
  });
  it("starts no further step after cancellation while reviewing", async () => {
    const input = fixture();
    const controller = new AbortController();
    input.checkpoint = vi.fn(() => controller.signal.throwIfAborted());
    input.review.mockImplementation(async () => {
      controller.abort();
      return {} as never;
    });
    await expect(prepareAutonomousSources(input)).rejects.toThrow();
    expect(input.transcribe).not.toHaveBeenCalled();
    expect(input.cache.reviews.size).toBe(0);
  });
  it.each(["captions", "audio"])(
    "avoids buying speech timing when source %s makes it unnecessary",
    async field => {
      const input = fixture();
      input.review.mockResolvedValue({
        summary: "Observed",
        review: {
          captions: field === "captions" ? "present" : "absent",
          audio: field === "audio" ? "absent" : "present",
        },
        retention: [],
      } as never);
      await prepareAutonomousSources(input);
      expect(input.transcribe).not.toHaveBeenCalled();
    }
  );
});
