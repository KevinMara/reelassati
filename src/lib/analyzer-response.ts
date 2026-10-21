import {
  ANALYZER_MAX_RESULT_BYTES,
  ANALYZER_STREAM_TYPE,
  type AnalyzerFrame,
} from "@contracts/analyzer-transport";

/** Read exactly one terminal result; never retry or expose partial model output. */
export async function unwrapAnalyzerResponse(
  response: Response,
  signal?: AbortSignal
): Promise<Response> {
  if (!response.headers.get("Content-Type")?.startsWith(ANALYZER_STREAM_TYPE))
    return response;
  if (!response.body)
    throw new Error(
      "The server returned an unexpected response. Reload the page and try again."
    );
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
    if (terminal) throw new Error("Duplicate analysis result");
    const frame = JSON.parse(line) as AnalyzerFrame;
    if (frame.type === "pending") return;
    if (
      frame.type !== "result" ||
      !Number.isInteger(frame.status) ||
      frame.status < 200 ||
      frame.status > 599 ||
      typeof frame.body !== "string"
    )
      throw new Error("Invalid analysis result");
    terminal = frame;
  };
  try {
    while (true) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > ANALYZER_MAX_RESULT_BYTES * 2)
        throw new Error("Analysis result is too large");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n")) >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 1);
      }
      if (chunk.done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!terminal) throw new Error("Incomplete analysis result");
    return new Response(terminal.body, {
      status: terminal.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new Error(
      "The server returned an unexpected response. Reload the page and try again."
    );
  } finally {
    signal?.removeEventListener("abort", canceled);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
