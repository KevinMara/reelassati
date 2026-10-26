import { describe, expect, it, vi } from "vitest";
import type { Asset, EditProject } from "@contracts/workspace";
import type { SavedAnalyzerReport } from "@contracts/analyzer-report";
import {
  createAutonomousPreparationCache,
  prepareAutonomousSources,
  findSavedAutonomousReview,
} from "./autonomous-preparation";

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
      },
      retention: [],
      changes: [],
      provenance: { origin: "ai-assisted" } as never,
    },
  };
}

describe("saved paid review reuse", () => {
  it("upgrades an open editor's legacy cache from a new saved spatial review without inference", async () => {
    const input = fixture(),
      old = savedReport();
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
    expect(input.review).not.toHaveBeenCalled();
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
    expect(result.analysis[0].visualProtection?.coverage).toBe("unknown");
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
