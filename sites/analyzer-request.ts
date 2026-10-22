import {
  ANALYZER_DEADLINE_MS,
  ANALYZER_HEARTBEAT_MS,
  ANALYZER_MAX_RESULT_BYTES,
  ANALYZER_STREAM_TYPE,
  type AnalyzerFrame,
} from "../contracts/analyzer-transport";

/** Cleanup callbacks must contain database bookkeeping only, never inference. */
export interface AnalysisControl {
  purpose?: "video-analysis" | "edit-planning";
  signal: AbortSignal;
  deadlineAt: number;
  onAbort(cleanup: () => Promise<unknown>): void;
  onInvocation?: (id: string) => Promise<void>;
  onCheck?: () => Promise<boolean>;
}

/** A single foreground request. No job, queue, retry or detached provider task. */
export function foregroundAnalysisResponse(
  request: Request,
  run: (request: Request, control: AnalysisControl) => Promise<Response>,
  keepCleanup?: (cleanup: Promise<unknown>) => void,
  failure = {
    error:
      "The video review is incomplete. Please refresh before analyzing again.",
    analysisIncomplete: true,
  }
): Response {
  const abort = new AbortController();
  const cleanups = new Set<() => Promise<unknown>>();
  let closed = false;
  let output: ReadableStreamDefaultController<Uint8Array> | undefined;
  let heartbeat: ReturnType<typeof setInterval>;
  let deadline: ReturnType<typeof setTimeout>;
  let checking = false;
  const stopTimers = () => {
    clearInterval(heartbeat);
    clearTimeout(deadline);
    request.signal.removeEventListener("abort", disconnect);
  };
  const clean = (tasks: Array<() => Promise<unknown>>) => {
    const cleanup = Promise.allSettled(
      tasks.map(task => Promise.resolve().then(task))
    ).then(results => {
      const failures = results.filter(
        result => result.status === "rejected"
      ).length;
      if (failures)
        console.error("Analysis database cleanup failed", { failures });
    });
    // Only the small, idempotent DB cleanup survives disconnect. Never model work.
    keepCleanup?.(cleanup);
  };
  const cancel = (reason: DOMException) => {
    if (abort.signal.aborted) return;
    abort.abort(reason);
    clean([...cleanups]);
    cleanups.clear();
  };
  const disconnect = () => {
    if (closed) return;
    closed = true;
    stopTimers();
    cancel(new DOMException("Analysis request disconnected", "AbortError"));
    try {
      output?.error(abort.signal.reason);
    } catch {
      /* reader already canceled */
    }
  };
  const control: AnalysisControl = {
    signal: abort.signal,
    deadlineAt: Date.now() + ANALYZER_DEADLINE_MS,
    onAbort(cleanup) {
      if (abort.signal.aborted) clean([cleanup]);
      else cleanups.add(cleanup);
    },
  };
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller;
      const write = (frame: AnalyzerFrame) => {
        if (!closed)
          controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      };
      const finish = (status: number, body: string) => {
        if (closed) return;
        write({ type: "result", status, body });
        closed = true;
        stopTimers();
        cleanups.clear();
        controller.close();
      };
      request.signal.addEventListener("abort", disconnect, { once: true });
      write({ type: "pending" });
      heartbeat = setInterval(() => {
        write({ type: "pending" });
        if (closed || checking || !control.onCheck) return;
        checking = true;
        void control
          .onCheck()
          .then(
            active => {
              if (!closed && !active)
                cancel(
                  new DOMException("Analysis request canceled", "AbortError")
                );
            },
            () => {
              if (!closed)
                cancel(
                  new DOMException(
                    "Analysis request state unavailable",
                    "AbortError"
                  )
                );
            }
          )
          .finally(() => {
            checking = false;
          });
      }, ANALYZER_HEARTBEAT_MS);
      deadline = setTimeout(() => {
        cancel(
          new DOMException("Analysis request deadline exceeded", "TimeoutError")
        );
        finish(504, JSON.stringify(failure));
      }, ANALYZER_DEADLINE_MS);
      if (request.signal.aborted) disconnect();
      // This promise belongs to the open response body. It is deliberately NOT
      // registered with waitUntil; closing the body aborts the provider request.
      void (async () => {
        try {
          abort.signal.throwIfAborted();
          const response = await run(
            new Request(request, { signal: abort.signal }),
            control
          );
          abort.signal.throwIfAborted();
          const body = await response.text();
          if (encoder.encode(body).byteLength > ANALYZER_MAX_RESULT_BYTES)
            throw new Error("Analysis response exceeds transport limit");
          finish(response.status, body);
        } catch {
          if (!abort.signal.aborted)
            cancel(new DOMException("Analysis response failed", "AbortError"));
          finish(502, JSON.stringify(failure));
        }
      })();
    },
    cancel() {
      disconnect();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": `${ANALYZER_STREAM_TYPE}; charset=utf-8`,
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Consume OpenRouter SSE; reasoning stays upstream and is never retained. */
export async function readAnalysisCompletion(
  response: Response,
  signal: AbortSignal
) {
  signal.throwIfAborted();
  if (!response.body) throw new Error("Analysis provider response is empty");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finished = false;
  let doneEvent = false;
  const consume = (event: string) => {
    const data = event
      .split("\n")
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    if (data === "[DONE]") {
      doneEvent = true;
      return;
    }
    if (doneEvent) throw new Error("Unexpected data after analysis completion");
    const payload = JSON.parse(data);
    if (payload.error) throw new Error("Analysis provider stream failed");
    const choice =
      payload.choices?.find((item: { index?: number }) => item.index === 0) ??
      payload.choices?.[0];
    if (!choice) return; // usage-only events
    if (choice.finish_reason && choice.finish_reason !== "stop")
      throw new Error("Analysis provider did not complete its report");
    const text = choice.delta?.content;
    if (finished && typeof text === "string" && text.length)
      throw new Error("Unexpected analysis content after finish");
    if (choice.finish_reason === "stop") finished = true;
    if (typeof text === "string") content += text;
    if (content.length > ANALYZER_MAX_RESULT_BYTES)
      throw new Error("Analysis provider response is too large");
  };
  const canceled = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", canceled, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      buffer = (
        buffer + decoder.decode(chunk.value, { stream: !chunk.done })
      ).replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
      if (buffer.length > ANALYZER_MAX_RESULT_BYTES)
        throw new Error("Analysis provider frame is too large");
      if (chunk.done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!finished || !doneEvent || !content.trim())
      throw new Error("Analysis provider response is incomplete");
    return { choices: [{ message: { content } }] };
  } finally {
    signal.removeEventListener("abort", canceled);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
