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

/** Read both documented OpenRouter completion audio and streamed audio deltas. */
export async function readMusicAudio(response: Response): Promise<ArrayBuffer> {
  if (!response.body)
    throw new MusicGenerationError("Music generation returned no audio.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: Uint8Array[] = [];
  const jsonResponse = /application\/(?:[\w.+-]+\+)?json/i.test(
    response.headers.get("content-type") || ""
  );
  let pending = "",
    total = 0,
    received = 0,
    done = false;
  let eventLines: string[] = [];
  const object = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const unreadable = () =>
    new MusicGenerationError(
      "The music provider returned an unreadable response. Please retry."
    );

  function consume(data: string) {
    if (data.trim() === "[DONE]") {
      done = true;
      return;
    }
    if (!data.trim()) return;
    let row: Record<string, unknown> | undefined;
    try {
      row = object(JSON.parse(data));
    } catch {
      throw unreadable();
    }
    if (!row || (row.choices !== undefined && !Array.isArray(row.choices)))
      throw unreadable();
    if (row.error)
      throw new MusicGenerationError(
        "The music provider could not complete this generation. Your credits will be returned."
      );
    for (const rawChoice of (row.choices ?? []) as unknown[]) {
      const choice = object(rawChoice);
      if (!choice) throw unreadable();
      // Different completion choices are different songs, never adjacent chunks.
      if (choice.index !== undefined && choice.index !== 0) continue;
      const delta = object(choice.delta) ?? object(choice.message);
      const audio = object(delta?.audio);
      const value = audio?.data;
      if (value === undefined || value === "") continue;
      if (typeof value !== "string") throw unreadable();
      let decoded: string;
      try {
        decoded = atob(value);
      } catch {
        throw new MusicGenerationError(
          "The music provider returned damaged audio. Please retry."
        );
      }
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      total += bytes.byteLength;
      if (total > 16 * 1024 * 1024)
        throw new MusicGenerationError(
          "The generated music exceeded the supported file size."
        );
      parts.push(bytes);
    }
  }
  function line(value: string) {
    if (!value) {
      if (eventLines.length) consume(eventLines.join("\n"));
      eventLines = [];
    } else if (value.startsWith("data:"))
      eventLines.push(value.slice(5).replace(/^ /, ""));
  }
  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > 24 * 1024 * 1024)
        throw new MusicGenerationError(
          "The music response exceeded the supported size."
        );
      pending += decoder.decode(chunk.value, { stream: true });
      if (jsonResponse) continue;
      let newline: number;
      while (!done && (newline = pending.indexOf("\n")) >= 0) {
        line(pending.slice(0, newline).replace(/\r$/, ""));
        pending = pending.slice(newline + 1);
      }
    }
    if (!done) {
      pending += decoder.decode();
      if (jsonResponse) {
        consume(pending);
        done = true;
      } else {
        if (pending) line(pending.replace(/\r$/, ""));
        line("");
      }
    }
    if (!total && done)
      throw new MusicGenerationError(
        "The music provider completed the request without audio. Please retry."
      );
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
  } catch (cause) {
    if (cause instanceof MusicGenerationError) throw cause;
    throw new MusicGenerationError(
      "The music stream was interrupted. Please retry."
    );
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

export type FinishedMusicAudio = {
  bytes: ArrayBuffer;
  contentType: "audio/wav" | "audio/mpeg";
  extension: "wav" | "mp3";
  duration: number;
};

type Mp3Frame = {
  start: number;
  end: number;
  rate: number;
  samples: number;
  channels: number;
  version: number;
  crc: boolean;
};
const ascii = (bytes: Uint8Array, offset: number, size: number) =>
  new TextDecoder().decode(bytes.subarray(offset, offset + size));
const invalidMp3 = () =>
  new MusicGenerationError(
    "The music provider returned damaged or incomplete MP3 audio. Please retry."
  );

function mp3Frame(bytes: Uint8Array, start: number): Mp3Frame {
  if (start + 4 > bytes.length) throw invalidMp3();
  const [a, b, c, d] = bytes.subarray(start, start + 4);
  const version = (b >> 3) & 3;
  const layer = (b >> 1) & 3;
  const bitrateIndex = c >> 4;
  const rateIndex = (c >> 2) & 3;
  if (
    a !== 255 ||
    (b & 224) !== 224 ||
    version === 1 ||
    layer !== 1 ||
    !bitrateIndex ||
    bitrateIndex === 15 ||
    rateIndex === 3 ||
    (d & 3) === 2
  )
    throw invalidMp3();
  const rate =
    [44100, 48000, 32000][rateIndex] /
    (version === 3 ? 1 : version === 2 ? 2 : 4);
  const bitrate = (
    version === 3
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  )[bitrateIndex];
  const size =
    Math.floor(((version === 3 ? 144000 : 72000) * bitrate) / rate) +
    ((c >> 1) & 1);
  const end = start + size;
  if (size < 24 || end > bytes.length) throw invalidMp3();
  return {
    start,
    end,
    rate,
    samples: version === 3 ? 1152 : 576,
    channels: d >> 6 === 3 ? 1 : 2,
    version,
    crc: !(b & 1),
  };
}

/** Lossless tail trim. Retain every leading frame so Layer III bit reservoirs remain intact. */
function finishMusicMp3(
  buffer: ArrayBuffer,
  seconds: number
): FinishedMusicAudio {
  const input = new Uint8Array(buffer);
  if (input.length > 16 * 1024 * 1024) throw invalidMp3();
  let start = 0;
  if (ascii(input, 0, 3) === "ID3") {
    if (
      input.length < 10 ||
      ![2, 3, 4].includes(input[3]) ||
      input[4] === 255 ||
      input.subarray(6, 10).some(value => value & 128)
    )
      throw invalidMp3();
    const length =
      input[6] * 2097152 + input[7] * 16384 + input[8] * 128 + input[9];
    start = 10 + length + (input[3] === 4 && input[5] & 16 ? 10 : 0);
    if (start >= input.length) throw invalidMp3();
  }
  let audioEnd = input.length;
  if (input.length >= 128 && ascii(input, input.length - 128, 3) === "TAG")
    audioEnd -= 128;
  const frames: Mp3Frame[] = [];
  for (let offset = start; offset < audioEnd;) {
    const frame = mp3Frame(input, offset);
    const previous = frames[0];
    if (
      frame.end > audioEnd ||
      (previous &&
        (frame.rate !== previous.rate ||
          frame.channels !== previous.channels ||
          frame.version !== previous.version))
    )
      throw invalidMp3();
    frames.push(frame);
    offset = frame.end;
  }
  if (frames.length < 2) throw invalidMp3();
  const first = frames[0];
  const view = new DataView(buffer);
  const sideInfo =
    first.version === 3
      ? first.channels === 1
        ? 17
        : 32
      : first.channels === 1
        ? 9
        : 17;
  const xingAt = first.start + 4 + (first.crc ? 2 : 0) + sideInfo;
  const xingName = ascii(input, xingAt, 4);
  const hasXing = xingName === "Xing" || xingName === "Info";
  const vbriAt = first.start + 36;
  const hasVbri = !hasXing && ascii(input, vbriAt, 4) === "VBRI";
  const metadataFrames = hasXing || hasVbri ? 1 : 0;
  let countAt = 0,
    sizeAt = 0,
    tocAt = 0,
    encoderAt = 0,
    delay = 0,
    padding = 0,
    gapless = false;
  if (hasXing) {
    if (xingAt + 8 > first.end) throw invalidMp3();
    const flags = view.getUint32(xingAt + 4, false);
    if (flags & ~15) throw invalidMp3();
    let cursor = xingAt + 8;
    if (flags & 1) {
      countAt = cursor;
      cursor += 4;
    }
    if (flags & 2) {
      sizeAt = cursor;
      cursor += 4;
    }
    if (flags & 4) {
      tocAt = cursor;
      cursor += 100;
    }
    if (flags & 8) cursor += 4;
    if (cursor > first.end) throw invalidMp3();
    if (
      cursor + 36 <= first.end &&
      /^(?:LAME|Lavc|Lavf)/.test(ascii(input, cursor, 9))
    ) {
      encoderAt = cursor;
      const packed =
        input[cursor + 21] * 65536 +
        input[cursor + 22] * 256 +
        input[cursor + 23];
      delay = packed >> 12;
      padding = packed & 4095;
      gapless = delay + padding > 0;
    }
  }
  const availableFrames = frames.length - metadataFrames;
  const availableSamples = availableFrames * first.samples - delay - padding;
  const requestedSamples = Math.round(seconds * first.rate);
  if (availableSamples < requestedSamples)
    throw new MusicGenerationError(
      "The generated music is shorter than requested. Please retry."
    );
  // Gapless MPEG audio has 529 decoder-delay samples in addition to the encoder
  // delay. Keep enough frames to carry them, and revise the LAME end padding.
  const keptAudioFrames = Math.min(
    availableFrames,
    Math.ceil((requestedSamples + delay + (gapless ? 529 : 0)) / first.samples)
  );
  const retainedFrames = metadataFrames + keptAudioFrames;
  const cut = frames[retainedFrames - 1].end;
  const suffix = input.subarray(audioEnd);
  const output = new Uint8Array(cut + suffix.length);
  output.set(input.subarray(0, cut));
  output.set(suffix, cut);
  const out = new DataView(output.buffer);
  const retainedBytes = cut - first.start;
  if (hasXing) {
    if (countAt) out.setUint32(countAt, keptAudioFrames, false);
    if (sizeAt) out.setUint32(sizeAt, retainedBytes, false);
    if (tocAt)
      for (let index = 0; index < 100; index++) {
        const frame =
          frames[
            Math.min(
              retainedFrames - 1,
              metadataFrames + Math.floor((index * keptAudioFrames) / 100)
            )
          ];
        output[tocAt + index] =
          index === 0
            ? 0
            : Math.min(
                255,
                Math.floor((256 * (frame.start - first.start)) / retainedBytes)
              );
      }
    if (gapless) {
      const newPadding =
        keptAudioFrames * first.samples - delay - requestedSamples;
      if (newPadding < 0 || newPadding > 4095) throw invalidMp3();
      const packed = (delay << 12) | newPadding;
      output[encoderAt + 21] = packed >> 16;
      output[encoderAt + 22] = (packed >> 8) & 255;
      output[encoderAt + 23] = packed & 255;
      // LAME stream size, optional music CRC (0 = unspecified), then tag CRC.
      out.setUint32(encoderAt + 28, retainedBytes, false);
      out.setUint16(encoderAt + 32, 0, false);
      let crc = 0;
      for (let index = first.start; index < encoderAt + 34; index++) {
        crc ^= output[index];
        for (let bit = 0; bit < 8; bit++)
          crc = (crc >> 1) ^ (crc & 1 ? 40961 : 0);
      }
      out.setUint16(encoderAt + 34, crc, false);
    }
  }
  // Fraunhofer VBRI stores a separate seek index in the first audio frame.
  if (hasVbri) {
    if (vbriAt + 26 > first.end || view.getUint16(vbriAt + 4, false) !== 1)
      throw invalidMp3();
    const entries = view.getUint16(vbriAt + 18, false),
      scale = view.getUint16(vbriAt + 20, false),
      width = view.getUint16(vbriAt + 22, false),
      perEntry = view.getUint16(vbriAt + 24, false);
    const needed = Math.ceil(keptAudioFrames / perEntry);
    if (
      !scale ||
      !perEntry ||
      ![1, 2, 3, 4].includes(width) ||
      needed > entries ||
      vbriAt + 26 + entries * width > first.end
    )
      throw invalidMp3();
    out.setUint32(vbriAt + 10, retainedBytes, false);
    out.setUint32(vbriAt + 14, keptAudioFrames, false);
    out.setUint16(vbriAt + 18, needed, false);
    for (let index = 0; index < entries; index++) {
      const begin = index * perEntry;
      const end = metadataFrames + Math.min(keptAudioFrames, begin + perEntry);
      let size =
        begin >= keptAudioFrames
          ? 0
          : Math.ceil(
              (frames[end - 1].end -
                frames[index === 0 ? 0 : metadataFrames + begin].start) /
                scale
            );
      if (size >= 2 ** (width * 8)) throw invalidMp3();
      for (let byte = width - 1; byte >= 0; byte--) {
        output[vbriAt + 26 + index * width + byte] = size & 255;
        size = Math.floor(size / 256);
      }
    }
  }
  return {
    bytes: output.buffer,
    contentType: "audio/mpeg",
    extension: "mp3",
    duration: gapless
      ? requestedSamples / first.rate
      : (keptAudioFrames * first.samples) / first.rate,
  };
}

/** Preserve the provider's native codec; Lyria Clip currently returns MP3. */
export function finishMusicAudio(
  buffer: ArrayBuffer,
  seconds: number
): FinishedMusicAudio {
  musicQuote(seconds);
  const input = new Uint8Array(buffer);
  if (ascii(input, 0, 4) === "RIFF" && ascii(input, 8, 4) === "WAVE")
    return {
      bytes: finishMusicWave(buffer, seconds),
      contentType: "audio/wav",
      extension: "wav",
      duration: seconds,
    };
  if (
    ascii(input, 0, 3) === "ID3" ||
    (input[0] === 255 && (input[1] & 224) === 224)
  )
    return finishMusicMp3(buffer, seconds);
  throw new MusicGenerationError(
    "The music provider did not return supported WAV or MP3 audio."
  );
}
