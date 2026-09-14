import { DELIVERY_COST_USD_PER_CREDIT } from "../contracts/billing";

export class MusicGenerationError extends Error {}

export const MUSIC_MODEL = "google/lyria-3-clip-preview";
export function musicQuote(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 3 || seconds > 30)
    throw new MusicGenerationError(
      "Choose a music duration between 3 and 30 seconds."
    );
  // Published $0.04/clip plus funding/delivery allowance; the full generation is billed even when trimmed.
  return Math.ceil(0.045 / DELIVERY_COST_USD_PER_CREDIT);
}

/** Read OpenRouter audio deltas across arbitrary SSE/network boundaries. */
export async function readMusicAudio(response: Response): Promise<ArrayBuffer> {
  if (!response.body)
    throw new MusicGenerationError("Music generation returned no audio.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: Uint8Array[] = [];
  let pending = "",
    total = 0,
    received = 0,
    done = false;
  function event(line: string) {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      done = true;
      return;
    }
    if (!data) return;
    const row = JSON.parse(data);
    if (row.error)
      throw new MusicGenerationError(
        "The music provider could not complete this generation. Your credits will be returned."
      );
    for (const choice of row.choices ?? []) {
      const value = choice.delta?.audio?.data;
      if (typeof value !== "string" || !value) continue;
      const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
      total += bytes.byteLength;
      if (total > 16 * 1024 * 1024)
        throw new MusicGenerationError(
          "The generated music exceeded the supported file size."
        );
      parts.push(bytes);
    }
  }
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > 24 * 1024 * 1024)
        throw new MusicGenerationError(
          "The music response exceeded the supported size."
        );
      pending += decoder.decode(chunk.value, { stream: true });
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        event(pending.slice(0, newline).replace(/\r$/, ""));
        pending = pending.slice(newline + 1);
      }
    }
    pending += decoder.decode();
    if (pending.trim()) event(pending.trim());
    if (!total || !done)
      throw new MusicGenerationError(
        "The music stream was incomplete. Please retry."
      );
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    return bytes.buffer;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Keep native PCM quality and finish the requested interval with a short, click-free fade. */
export function finishMusicWave(
  buffer: ArrayBuffer,
  seconds: number
): ArrayBuffer {
  musicQuote(seconds);
  const input = new Uint8Array(buffer),
    view = new DataView(buffer);
  const text = (offset: number) =>
    new TextDecoder().decode(input.subarray(offset, offset + 4));
  if (input.length < 44 || text(0) !== "RIFF" || text(8) !== "WAVE")
    throw new MusicGenerationError(
      "The music provider did not return a supported WAV file."
    );
  let channels = 0,
    rate = 0,
    dataStart = 0,
    dataSize = 0;
  for (let offset = 12; offset + 8 <= input.length;) {
    const length = view.getUint32(offset + 4, true);
    if (offset + 8 + length > input.length)
      throw new MusicGenerationError("The generated music is truncated.");
    if (text(offset) === "fmt ") {
      if (
        length < 16 ||
        view.getUint16(offset + 8, true) !== 1 ||
        view.getUint16(offset + 22, true) !== 16
      )
        throw new MusicGenerationError(
          "The music provider returned an unsupported sample format."
        );
      channels = view.getUint16(offset + 10, true);
      rate = view.getUint32(offset + 12, true);
      if (
        ![1, 2].includes(channels) ||
        rate < 16000 ||
        rate > 96000 ||
        view.getUint16(offset + 20, true) !== channels * 2 ||
        view.getUint32(offset + 16, true) !== rate * channels * 2
      )
        throw new MusicGenerationError(
          "The generated music has invalid audio settings."
        );
    }
    if (text(offset) === "data") {
      dataStart = offset + 8;
      dataSize = length;
      break;
    }
    offset += 8 + length + (length % 2);
  }
  const frames = Math.round(seconds * rate),
    size = frames * channels * 2;
  if (!rate || !dataStart || !size || dataSize < size)
    throw new MusicGenerationError(
      "The generated music is shorter than requested. Please retry."
    );
  const output = input.slice(0, dataStart + size);
  const out = new DataView(output.buffer);
  out.setUint32(4, output.length - 8, true);
  out.setUint32(dataStart - 4, size, true);
  const fade = Math.min(Math.round(rate * 0.08), frames);
  for (let frame = 0; frame < fade; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const offset =
        dataStart + ((frames - fade + frame) * channels + channel) * 2;
      out.setInt16(
        offset,
        Math.round(out.getInt16(offset, true) * (1 - frame / (fade - 1))),
        true
      );
    }
  }
  return output.buffer;
}
