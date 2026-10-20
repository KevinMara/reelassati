import { describe, expect, it, vi } from "vitest";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  createAutonomousPreparationCache,
  prepareAutonomousSources,
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
describe("auto-edit source preparation recovery", () => {
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
