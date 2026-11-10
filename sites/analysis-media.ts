import {
  readMp4VideoTiming,
  readMp4VideoTimingByRange,
  sameAnalysisVideoTiming,
  type AnalysisVideoTiming,
} from "../contracts/analysis-proxy";

/** An observed proxy frame rate is separate from equivalence with its original. */
export function analysisProxyFrameRate(buffer: ArrayBuffer): number | null {
  const timing = readMp4VideoTiming(buffer);
  return timing
    ? Math.round((timing.frameTimes.length / timing.videoDuration) * 1000) /
        1000
    : null;
}

/** The request descriptor is only a hint. Compare both actual owned files before lifting legacy limits. */
export async function verifyFullFrameAnalysisProxy(
  descriptor: unknown,
  proxyBytes: ArrayBuffer,
  original: {
    contentType: string;
    size: number;
    read: (offset: number, length: number) => Promise<ArrayBuffer | null>;
  }
): Promise<AnalysisVideoTiming | null> {
  if (
    !descriptor ||
    typeof descriptor !== "object" ||
    (descriptor as { version?: unknown }).version !== "full-frame-v1" ||
    !["video/mp4", "video/quicktime"].includes(original.contentType)
  )
    return null;
  const proxy = readMp4VideoTiming(proxyBytes);
  if (!proxy) return null;
  const source = await readMp4VideoTimingByRange(original.size, original.read);
  return source && sameAnalysisVideoTiming(source, proxy) ? proxy : null;
}

/** Read the movie header duration from actual uploaded proxy bytes, without decoding video. */
export function mp4MovieDuration(buffer: ArrayBuffer): number | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const box = (offset: number, end: number) => {
    if (offset + 8 > end) return null;
    let size = view.getUint32(offset);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) return null;
      const extended = view.getBigUint64(offset + 8);
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(extended);
      header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || offset + size > end) return null;
    return {
      type: String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)),
      data: offset + header,
      end: offset + size,
    };
  };
  for (let offset = 0; offset < bytes.length;) {
    const top = box(offset, bytes.length);
    if (!top) return null;
    if (top.type === "moov") {
      for (let child = top.data; child < top.end;) {
        const inner = box(child, top.end);
        if (!inner) return null;
        if (inner.type === "mvhd") {
          const version = bytes[inner.data];
          const scaleOffset =
            version === 0
              ? inner.data + 12
              : version === 1
                ? inner.data + 20
                : -1;
          const durationOffset =
            version === 0 ? inner.data + 16 : inner.data + 24;
          const durationBytes = version === 0 ? 4 : 8;
          if (scaleOffset < 0 || durationOffset + durationBytes > inner.end)
            return null;
          const scale = view.getUint32(scaleOffset);
          const raw =
            version === 0
              ? BigInt(view.getUint32(durationOffset))
              : view.getBigUint64(durationOffset);
          if (!scale || raw > BigInt(Number.MAX_SAFE_INTEGER)) return null;
          const duration = Number(raw) / scale;
          return Number.isFinite(duration) && duration > 0 && duration <= 86400
            ? duration
            : null;
        }
        child = inner.end;
      }
    }
    offset = top.end;
  }
  return null;
}

export function validateAnalysisProxyDuration(
  sourceDuration: number | undefined,
  buffer: ArrayBuffer
): number {
  if (
    !sourceDuration ||
    !Number.isFinite(sourceDuration) ||
    sourceDuration > 86400
  )
    throw new Error(
      "Read and save the original video duration before preparing an analysis copy."
    );
  const proxyDuration = mp4MovieDuration(buffer);
  if (!proxyDuration)
    throw new Error("The analysis copy has no readable MP4 duration.");
  if (
    Math.abs(sourceDuration - proxyDuration) >
    Math.max(0.3, sourceDuration * 0.002)
  )
    throw new Error(
      "The analysis copy does not cover the complete original duration. Prepare it again without trimming the video."
    );
  return proxyDuration;
}
