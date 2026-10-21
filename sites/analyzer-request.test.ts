import { afterEach, describe, expect, it, vi } from "vitest";
import {
  foregroundAnalysisResponse,
  readAnalysisCompletion,
  type AnalysisControl,
} from "./analyzer-request";
import { unwrapAnalyzerResponse } from "../src/lib/analyzer-response";
import { ANALYZER_DEADLINE_MS } from "../contracts/analyzer-transport";

afterEach(() => vi.useRealTimers());

describe("foreground analyzer transport", () => {
  it("keeps a slow request readable past the observed 65-second cancellation without returning partial output", async () => {
    vi.useFakeTimers();
    let finish!: (value: Response) => void;
    let control!: AnalysisControl;
    const run = vi.fn((_, active: AnalysisControl) => {
      control = active;
      return new Promise<Response>(resolve => {
        finish = resolve;
      });
    });
    const response = foregroundAnalysisResponse(
      new Request("https://test/api/ai/analyze"),
      run
    );
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      '"type":"pending"'
    );
    await vi.advanceTimersByTimeAsync(70_000);
    expect(control.signal.aborted).toBe(false);
    const chunks: string[] = [];
    for (let index = 0; index < 7; index++)
      chunks.push(new TextDecoder().decode((await reader.read()).value));
    expect(chunks.every(chunk => chunk === '{"type":"pending"}\n')).toBe(true);
    finish(Response.json({ summary: "Complete validated report" }));
    const terminal = new TextDecoder().decode((await reader.read()).value);
    expect(JSON.parse(terminal)).toMatchObject({ type: "result", status: 200 });
    expect(terminal).toContain("Complete validated report");
    expect((await reader.read()).done).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["disconnect", "deadline"])(
    "aborts once and retains only DB cleanup after %s",
    async mode => {
      vi.useFakeTimers();
      const cleanup = vi.fn(async () => undefined);
      const retained: Promise<unknown>[] = [];
      let control!: AnalysisControl;
      const run = vi.fn((_, active: AnalysisControl) => {
        control = active;
        active.onAbort(cleanup);
        return new Promise<Response>((_, reject) =>
          active.signal.addEventListener(
            "abort",
            () => reject(active.signal.reason),
            { once: true }
          )
        );
      });
      const response = foregroundAnalysisResponse(
        new Request("https://test/api/ai/analyze"),
        run,
        task => retained.push(task)
      );
      if (mode === "disconnect") await response.body!.cancel();
      else {
        const output = unwrapAnalyzerResponse(response);
        await vi.advanceTimersByTimeAsync(ANALYZER_DEADLINE_MS);
        expect((await output).status).toBe(504);
      }
      await Promise.all(retained);
      expect(control.signal.aborted).toBe(true);
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it("releases a hold that finishes being reserved after disconnect, without starting a provider", async () => {
    let finishReserve!: () => void;
    const reserved = new Promise<void>(resolve => {
      finishReserve = resolve;
    });
    const cleanup = vi.fn(async () => undefined);
    const provider = vi.fn();
    const retained: Promise<unknown>[] = [];
    const response = foregroundAnalysisResponse(
      new Request("https://test/api/ai/analyze"),
      async (_, control) => {
        await reserved;
        control.onAbort(cleanup);
        control.signal.throwIfAborted();
        provider();
        return Response.json({});
      },
      task => retained.push(task)
    );
    await response.body!.cancel();
    finishReserve();
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1));
    await Promise.all(retained);
    expect(provider).not.toHaveBeenCalled();
  });
});

const event = (payload: unknown) => `data: ${JSON.stringify(payload)}\r\n\r\n`;
const chunk = (content: string, reason: string | null = null) => ({
  choices: [{ index: 0, delta: { content }, finish_reason: reason }],
});
function source(text: string, width = 7) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(offset, offset + width));
        offset += width;
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } }
  );
}
describe("OpenRouter analysis stream", () => {
  it("handles fragmented Unicode, comments, reasoning and the repeated usage finish event", async () => {
    const report = JSON.stringify({ summary: "Caffè 🎬" });
    const response = source(
      ": OPENROUTER PROCESSING\r\n\r\n" +
        event({
          choices: [
            {
              delta: { reasoning: "Do not retain or expose private reasoning" },
            },
          ],
        }) +
        event(chunk(report)) +
        event(chunk("", "stop")) +
        event({ ...chunk("", "stop"), usage: { completion_tokens: 12 } }) +
        "data: [DONE]\r\n\r\n",
      1
    );
    expect(
      await readAnalysisCompletion(response, new AbortController().signal)
    ).toEqual({ choices: [{ message: { content: report } }] });
  });
  it.each([
    event(chunk('{"summary":"truncated"}')),
    event(chunk("{}", "length")) + "data: [DONE]\n\n",
    event({
      error: { message: "Untrusted provider body" },
      choices: [{ finish_reason: "error" }],
    }),
    event(chunk("", "stop")) + "data: [DONE]\n\n",
    "data: broken-json\n\n",
  ])(
    "rejects failed/incomplete streams instead of accepting their HTTP 200",
    async text => {
      await expect(
        readAnalysisCompletion(source(text), new AbortController().signal)
      ).rejects.toThrow();
    }
  );
  it("cancels an upstream reader on abort", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }), {
      headers: { "Content-Type": "text/event-stream" },
    });
    const abort = new AbortController();
    const rejected = expect(
      readAnalysisCompletion(response, abort.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    abort.abort();
    await rejected;
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
