import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset, EditProject } from "@contracts/workspace";
import { parseLocalTranscriptSegments } from "@contracts/local-transcript";
import {
  getTranscriptCutWords,
  buildTranscriptCutPlan,
} from "./transcript-cuts";
import { transcribeMediaLocally } from "./local-transcription";

const localApi = vi.hoisted(() => ({
  captureUploadRequestScope: vi.fn(),
  downloadAssetBlob: vi.fn(),
  registerLocalTranscript: vi.fn(),
}));
vi.mock("./platform-api", () => ({
  captureUploadRequestScope: localApi.captureUploadRequestScope,
  platformApi: localApi,
}));
import {
  localSpeechSegments,
  type LocalSpeechOutput,
} from "./local-speech-segments";

describe("measured local speech timing", () => {
  it("groups words without changing boundaries and ends a phrase at punctuation", () => {
    const segments = localSpeechSegments(
      {
        text: "Ciao mondo. Nuova frase",
        chunks: [
          { text: " Ciao", timestamp: [0.12, 0.4] },
          { text: " mondo.", timestamp: [0.41, 0.8] },
          { text: " Nuova", timestamp: [1, 1.2] },
          { text: " frase", timestamp: [1.22, 1.7] },
        ],
      },
      2
    );
    expect(segments.map(s => [s.text, s.start, s.end])).toEqual([
      ["Ciao mondo.", 0.12, 0.8],
      ["Nuova frase", 1, 1.7],
    ]);
    expect(segments[0].words?.[0]).toEqual({
      text: "Ciao",
      start: 0.12,
      end: 0.4,
    });
  });
  it("clamps a measured endpoint to the source but rejects words entirely outside it", () => {
    expect(
      localSpeechSegments(
        { text: "fine", chunks: [{ text: "fine", timestamp: [1.8, 2.1] }] },
        2
      )[0].end
    ).toBe(2);
    expect(() =>
      localSpeechSegments(
        { text: "oltre", chunks: [{ text: "oltre", timestamp: [2.1, 2.4] }] },
        2
      )
    ).toThrow("usable word timings");
  });
  it.each([null, NaN, Infinity])(
    "rejects missing or nonfinite endpoints (%s)",
    end => {
      expect(() =>
        localSpeechSegments(
          {
            text: "test",
            chunks: [{ text: "test", timestamp: [0, end] }],
          } as LocalSpeechOutput,
          2
        )
      ).toThrow();
    }
  );
  it("rejects nonempty untimed output and reversed ordering", () => {
    expect(() => localSpeechSegments({ text: "untimed" }, 2)).toThrow();
    expect(() =>
      localSpeechSegments(
        {
          text: "a b",
          chunks: [
            { text: "a", timestamp: [1, 1.2] },
            { text: "b", timestamp: [0.5, 0.7] },
          ],
        },
        2
      )
    ).toThrow("unordered");
    expect(localSpeechSegments({ text: "", chunks: [] }, 2)).toEqual([]);
  });
  it("rejects partial word alignment instead of silently dropping recognized speech", () => {
    expect(() =>
      localSpeechSegments(
        {
          text: "first missing last",
          chunks: [
            { text: "first", timestamp: [0, 0.3] },
            { text: "last", timestamp: [1, 1.3] },
          ],
        },
        2
      )
    ).toThrow("incomplete word timings");
    expect(() =>
      localSpeechSegments(
        { text: "", chunks: [{ text: "extra", timestamp: [0, 0.3] }] },
        2
      )
    ).toThrow("incomplete word timings");
    expect(
      localSpeechSegments(
        {
          text: " first  last ",
          chunks: [
            { text: "first", timestamp: [0, 0.3] },
            { text: " last", timestamp: [0.4, 0.7] },
          ],
        },
        2
      )[0].text
    ).toBe("first last");
  });
  it("rejects decreasing word ends so every word stays inside its segment", () => {
    expect(() =>
      localSpeechSegments(
        {
          text: "first last",
          chunks: [
            { text: "first", timestamp: [0, 1.8] },
            { text: "last", timestamp: [1, 1.3] },
          ],
        },
        2
      )
    ).toThrow("unordered word timings");
  });
  it.each([null, NaN, Infinity, -1])(
    "rejects invalid word starts (%s)",
    start => {
      expect(() =>
        localSpeechSegments(
          { text: "word", chunks: [{ text: "word", timestamp: [start, 1] }] },
          2
        )
      ).toThrow("usable word timings");
    }
  );
  it("rejects all-zero timing without a measured neighbour and invalid source duration", () => {
    expect(() =>
      localSpeechSegments(
        { text: "word", chunks: [{ text: "word", timestamp: [1, 1] }] },
        2
      )
    ).toThrow("usable word timings");
    expect(() => localSpeechSegments({ text: "", chunks: [] }, 0)).toThrow(
      "source duration"
    );
  });
  it("coalesces ambiguous lexical tokens using measured outer boundaries and preserves all text", () => {
    const output: LocalSpeechOutput = {
      text: "Se tu puoi farlo, fallo ora.",
      chunks: [
        { text: " Se", timestamp: [0.2, 0.2] },
        { text: " tu", timestamp: [0.2, 0.2] },
        { text: " puoi", timestamp: [0.2, 0.6] },
        { text: " farlo,", timestamp: [0.6, 0.6] },
        { text: " fallo", timestamp: [0.6, 1] },
        { text: " ora.", timestamp: [1, 1] },
      ],
    };
    const segments = localSpeechSegments(output, 2);
    expect(segments.flatMap(segment => segment.words ?? [])).toEqual([
      { text: "Se tu puoi", start: 0.2, end: 0.6 },
      { text: "farlo, fallo ora.", start: 0.6, end: 1 },
    ]);
    expect(segments.map(segment => segment.text).join(" ")).toBe(output.text);
    expect(parseLocalTranscriptSegments(segments, 2)).toEqual(segments);
  });
  it("exposes an ambiguous group as one cut selection with no fabricated internal clock", () => {
    const segments = localSpeechSegments(
      {
        text: "Se puoi vai",
        chunks: [
          { text: " Se", timestamp: [0.2, 0.2] },
          { text: " puoi", timestamp: [0.2, 0.6] },
          { text: " vai", timestamp: [0.6, 1] },
        ],
      },
      2
    );
    const source: Asset = {
      id: "source",
      name: "Source",
      kind: "video",
      contentType: "video/mp4",
      url: "/source",
      size: 100,
      duration: 2,
      status: "ready",
      createdAt: "now",
    };
    const project: EditProject = {
      id: "p",
      title: "Speech",
      template: "blank",
      status: "editing",
      platform: "instagram",
      aspectRatio: "1:1",
      duration: 2,
      playhead: 0,
      createdAt: "now",
      updatedAt: "now",
      revisions: [],
      proposedChanges: [],
      qualitySignals: [],
      transcript: segments.map(segment => ({
        ...segment,
        sourceClipId: "clip",
      })),
      clips: [
        {
          id: "clip",
          assetId: "source",
          track: "video",
          label: "Source",
          start: 0,
          duration: 2,
          inPoint: 0,
          outPoint: 2,
          locked: false,
          color: "#fff",
        },
      ],
    };
    const choices = getTranscriptCutWords(project, [source]);
    expect(choices.map(word => [word.text, word.start, word.end])).toEqual([
      ["Se puoi", 0.2, 0.6],
      ["vai", 0.6, 1],
    ]);
    expect(
      buildTranscriptCutPlan(project, [source], [choices[0]]).intervals
    ).toEqual([{ start: 0.2, end: 0.6 }]);
  });
});

describe("foreground local transcription lifetime", () => {
  const asset = { id: "source", kind: "audio", duration: 2 } as Asset;
  const workers: Array<{
    onmessage: ((event: { data: unknown }) => void) | null;
    onerror: (() => void) | null;
    onmessageerror: (() => void) | null;
    terminate: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
  }> = [];
  let page: EventTarget;
  let decode: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    workers.length = 0;
    page = new EventTarget();
    vi.stubGlobal("window", Object.assign(page, { setTimeout, clearTimeout }));
    localApi.captureUploadRequestScope.mockResolvedValue({
      ownerEmail: "owner@example.com",
      brandId: "default",
    });
    localApi.downloadAssetBlob.mockResolvedValue(new Blob(["audio"]));
    localApi.registerLocalTranscript.mockImplementation(async input => ({
      segments: input.segments,
    }));
    decode = vi.fn().mockResolvedValue({ duration: 2 });
    close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "AudioContext",
      class {
        decodeAudioData = decode;
        close = close;
      }
    );
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        destination = {};
        createBufferSource = () => ({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
        });
        startRendering = async () => ({
          getChannelData: () => new Float32Array(32_000),
        });
      }
    );
    vi.stubGlobal(
      "Worker",
      class {
        onmessage = null;
        onerror = null;
        onmessageerror = null;
        terminate = vi.fn();
        postMessage = vi.fn();
        constructor() {
          workers.push(this);
        }
      }
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const waitForWorker = async () => {
    await vi.waitFor(() => expect(workers).toHaveLength(1));
    return workers[0];
  };

  it("closes decoding promptly on Stop and never starts a worker for a late decode", async () => {
    let finishDecode!: (buffer: { duration: number }) => void;
    decode.mockImplementation(
      () =>
        new Promise(resolve => {
          finishDecode = resolve;
        })
    );
    const controller = new AbortController();
    const pending = transcribeMediaLocally(
      asset,
      undefined,
      undefined,
      undefined,
      controller.signal
    );
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.waitFor(() => expect(decode).toHaveBeenCalled());
    controller.abort();
    await rejected;
    expect(close).toHaveBeenCalledOnce();
    finishDecode({ duration: 2 });
    await Promise.resolve();
    expect(workers).toHaveLength(0);
    expect(localApi.registerLocalTranscript).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("terminates the worker on pagehide and ignores any late result", async () => {
    const pending = transcribeMediaLocally(asset);
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    const worker = await waitForWorker();
    const lateMessage = worker.onmessage!;
    page.dispatchEvent(new Event("pagehide"));
    await rejected;
    lateMessage({
      data: {
        type: "result",
        output: { text: "late", chunks: [{ text: "late", timestamp: [0, 1] }] },
      },
    });
    expect(worker.terminate).toHaveBeenCalled();
    expect(worker.onmessage).toBeNull();
    expect(localApi.registerLocalTranscript).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("terminates timed-out inference without registering a transcript", async () => {
    const pending = transcribeMediaLocally(asset);
    const rejected = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
    });
    const worker = await waitForWorker();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    await rejected;
    expect(worker.terminate).toHaveBeenCalled();
    expect(localApi.registerLocalTranscript).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("saves measured words and clears the worker and timeout after success", async () => {
    const pending = transcribeMediaLocally(asset);
    const worker = await waitForWorker();
    worker.onmessage!({
      data: {
        type: "result",
        output: {
          text: "Ciao",
          chunks: [{ text: " Ciao", timestamp: [0.1, 0.7] }],
        },
      },
    });
    const result = await pending;
    expect(result.segments[0]).toMatchObject({
      text: "Ciao",
      start: 0.1,
      end: 0.7,
      words: [{ text: "Ciao", start: 0.1, end: 0.7 }],
    });
    expect(localApi.registerLocalTranscript).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalled();
    expect(worker.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
