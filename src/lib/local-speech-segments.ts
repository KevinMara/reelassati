import type { TranscriptSegment } from "@contracts/workspace";

export interface LocalSpeechOutput {
  text: string;
  chunks?: Array<{ text: string; timestamp: [number | null, number | null] }>;
}

/** Preserve measured word boundaries; never manufacture timestamps for missing words. */
export function localSpeechSegments(
  output: LocalSpeechOutput,
  duration: number
): TranscriptSegment[] {
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("Invalid speech source duration.");
  if (
    !output ||
    typeof output.text !== "string" ||
    (output.chunks !== undefined && !Array.isArray(output.chunks))
  ) {
    throw new Error(
      "The local model returned an invalid transcript. No paid fallback was started."
    );
  }
  const measured = (output.chunks ?? []).flatMap((chunk, index) => {
    if (
      !chunk ||
      typeof chunk.text !== "string" ||
      !Array.isArray(chunk.timestamp) ||
      chunk.timestamp.length !== 2
    ) {
      throw new Error(
        `The local model returned speech without usable word timings (word ${index + 1}: malformed timestamp). No paid fallback was started.`
      );
    }
    const text = chunk.text.trim();
    if (!text) return [];
    const [start, rawEnd] = chunk.timestamp;
    const end =
      rawEnd === null || !Number.isFinite(rawEnd)
        ? NaN
        : Math.min(duration, rawEnd);
    if (
      start === null ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      (end === start && rawEnd !== start)
    ) {
      throw new Error(
        `The local model returned speech without usable word timings (word ${index + 1}: start=${String(start)}, end=${String(rawEnd)}, source=${duration}s). No paid fallback was started.`
      );
    }
    return [{ text, start, end }];
  });
  if (output.text.trim() && !measured.length)
    throw new Error(
      "The local model returned speech without usable word timings. No paid fallback was started."
    );
  // Whisper's word decoder joins chunks into the full transcript. Whitespace
  // can differ across languages, but missing words must never be silently lost.
  const withoutSpacing = (text: string) =>
    text.normalize("NFC").replace(/\s/gu, "");
  if (
    withoutSpacing(measured.map(word => word.text).join("")) !==
    withoutSpacing(output.text)
  ) {
    throw new Error(
      "The local model returned incomplete word timings. No paid fallback was started."
    );
  }
  if (
    measured.some(
      (word, index) =>
        index > 0 &&
        (word.start < measured[index - 1].start ||
          word.end < measured[index - 1].end)
    )
  )
    throw new Error(
      "The local model returned unordered word timings. No paid fallback was started."
    );
  // DTW can place several lexical tokens at the same measured instant. Retain
  // every token as one indivisible multiword entry with the adjacent measured
  // interval; never invent an internal boundary or emit a zero-length cut.
  const words: typeof measured = [];
  let pending: typeof measured = [];
  const joinText = (parts: string[]) =>
    parts.join(" ").replace(/\s+([,.;:!?…])/gu, "$1");
  for (const word of measured) {
    if (word.end === word.start) {
      pending.push(word);
      continue;
    }
    words.push(
      pending.length
        ? {
            text: joinText([...pending.map(item => item.text), word.text]),
            start: pending[0].start,
            end: word.end,
          }
        : word
    );
    pending = [];
  }
  if (pending.length) {
    const previous = words.at(-1);
    if (!previous)
      throw new Error(
        "The local model returned speech without usable word timings. No paid fallback was started."
      );
    previous.text = joinText([
      previous.text,
      ...pending.map(item => item.text),
    ]);
    previous.end = pending.at(-1)!.end;
  }
  const segments: TranscriptSegment[] = [];
  for (let index = 0; index < words.length;) {
    let end = index + 1;
    while (
      end < words.length &&
      end - index < 7 &&
      words[end].end - words[index].start < 3.2 &&
      !/[.!?]$/.test(words[end - 1].text)
    )
      end++;
    const group = words.slice(index, end);
    segments.push({
      id: crypto.randomUUID(),
      text: group.map(w => w.text).join(" "),
      start: group[0].start,
      end: group.at(-1)!.end,
      words: group,
    });
    index = end;
  }
  return segments;
}
