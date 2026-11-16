import {
  ANALYZER_MAX_RESULT_BYTES,
  ANALYZER_STREAM_TYPE,
  type AnalyzerFrame,
} from "@contracts/analyzer-transport";

export class AnalyzerTransportError extends Error {
  readonly code: "empty" | "interrupted" | "incomplete" | "invalid" | "oversized";
  constructor(
    code:
      "empty" | "interrupted" | "incomplete" | "invalid" | "oversized"
  ) {
    super(
      {
        empty:
          "The server returned an empty response. Completed work is preserved; reload before continuing.",
        interrupted:
          "The connection was interrupted while receiving the result. Completed work is preserved; reload before continuing.",
        incomplete:
          "The connection ended before a final result arrived. Completed work is preserved; reload before continuing.",
        invalid:
          "The server response could not be read. Completed work is preserved; reload before continuing.",
        oversized:
          "The server response exceeded the supported size. Completed work is preserved.",
      }[code]
    );
    this.name = "AnalyzerTransportError";
    this.code = code;
  }
}

/** Read exactly one terminal result; never retry or expose partial model output. */
export async function unwrapAnalyzerResponse(
  response: Response,
  signal?: AbortSignal
): Promise<Response> {
  if (!response.headers.get("Content-Type")?.startsWith(ANALYZER_STREAM_TYPE))
    return response;
  if (!response.body) throw new AnalyzerTransportError("empty");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal: Extract<AnalyzerFrame, { type: "result" }> | undefined;
  const canceled = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", canceled, { once: true });
  const consume = (line: string) => {
    if (!line.trim()) return;
    if (terminal) throw new AnalyzerTransportError("invalid");
    let frame: AnalyzerFrame;
    try {
      frame = JSON.parse(line) as AnalyzerFrame;
    } catch {
      throw new AnalyzerTransportError("invalid");
    }
    if (!frame || typeof frame !== "object")
      throw new AnalyzerTransportError("invalid");
    if (frame.type === "pending") return;
    if (
      frame.type !== "result" ||
      !Number.isInteger(frame.status) ||
      frame.status < 200 ||
      frame.status > 599 ||
      typeof frame.body !== "string"
    )
      throw new AnalyzerTransportError("invalid");
    terminal = frame;
  };
  try {
    while (true) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > ANALYZER_MAX_RESULT_BYTES * 2)
        throw new AnalyzerTransportError("oversized");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n")) >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 1);
      }
      if (chunk.done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!terminal) throw new AnalyzerTransportError("incomplete");
    return new Response(terminal.body, {
      status: terminal.status,
      headers: {
        "Content-Type": "application/json",
        ...(terminal.replayed === true
          ? { "X-REELassati-Replayed": "true" }
          : {}),
      },
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    if (cause instanceof AnalyzerTransportError) throw cause;
    throw new AnalyzerTransportError("interrupted");
  } finally {
    signal?.removeEventListener("abort", canceled);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
