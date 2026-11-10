/** This descriptor requests verification; it never proves that a model saw every frame. */
export type AnalysisProxyDescriptor = { version: "full-frame-v1" };

export const MAX_MP4_METADATA_BYTES = 8 * 1024 * 1024;
export const MAX_ANALYSIS_FRAMES = 432_000;

export interface AnalysisVideoTiming {
  duration: number;
  videoDuration: number;
  frameTimes: Float64Array;
  displayAspect: number;
  rotation: number;
  width: number;
  height: number;
  audioDuration: number | null;
}

type Box = { type: string; data: number; end: number };
const invalid = () => {
  throw new Error("Unverifiable MP4 metadata");
};

/** Fixed-depth, bounded parsing of ordinary (non-fragmented) MP4 sample tables. */
export function readMp4VideoTiming(
  buffer: ArrayBuffer
): AnalysisVideoTiming | null {
  try {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let boxesRead = 0;
    const boxes = (start: number, end: number): Box[] => {
      const result: Box[] = [];
      for (let offset = start; offset < end;) {
        if (++boxesRead > 4096 || offset + 8 > end) invalid();
        let size = view.getUint32(offset),
          header = 8;
        if (size === 1) {
          if (offset + 16 > end) invalid();
          const large = view.getBigUint64(offset + 8);
          if (large > BigInt(Number.MAX_SAFE_INTEGER)) invalid();
          size = Number(large);
          header = 16;
        } else if (size === 0) size = end - offset;
        if (size < header || offset + size > end) invalid();
        result.push({
          type: String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)),
          data: offset + header,
          end: offset + size,
        });
        offset += size;
      }
      return result;
    };
    const one = (
      items: Box[],
      type: string,
      required = true
    ): Box | undefined => {
      const matches = items.filter(item => item.type === type);
      if (matches.length > 1 || (required && matches.length !== 1)) invalid();
      return matches[0];
    };
    const need = (box: Box, offset: number, length: number) => {
      if (offset < box.data || offset + length > box.end) invalid();
    };
    const timeHeader = (box: Box) => {
      need(box, box.data, 4);
      const version = bytes[box.data];
      if (version !== 0 && version !== 1) invalid();
      const at = box.data + (version === 0 ? 12 : 20);
      need(box, at, version === 0 ? 8 : 12);
      const scale = view.getUint32(at);
      const raw =
        version === 0
          ? BigInt(view.getUint32(at + 4))
          : view.getBigUint64(at + 4);
      if (!scale || raw > BigInt(Number.MAX_SAFE_INTEGER)) invalid();
      const duration = Number(raw) / scale;
      if (!(duration > 0 && duration <= 86400)) invalid();
      return { scale, duration };
    };
    const top = boxes(0, bytes.length);
    if (top.some(box => box.type === "moof")) invalid();
    const moov = one(top, "moov")!;
    if (moov.end - moov.data > MAX_MP4_METADATA_BYTES) invalid();
    const movie = boxes(moov.data, moov.end);
    if (movie.some(box => box.type === "mvex")) invalid();
    const movieTime = timeHeader(one(movie, "mvhd")!);
    let video: Omit<AnalysisVideoTiming, "audioDuration"> | undefined;
    let audioDuration: number | null = null;
    for (const trak of movie.filter(box => box.type === "trak")) {
      const track = boxes(trak.data, trak.end);
      const mdia = one(track, "mdia")!;
      const media = boxes(mdia.data, mdia.end);
      const handler = one(media, "hdlr")!;
      need(handler, handler.data, 12);
      const kind = String.fromCharCode(
        ...bytes.subarray(handler.data + 8, handler.data + 12)
      );
      if (kind !== "vide" && kind !== "soun") continue;
      const mediaTime = timeHeader(one(media, "mdhd")!);
      let mediaStart = 0,
        emptyLead = 0,
        editDuration: number | undefined;
      const edts = one(track, "edts", false);
      if (edts) {
        const elst = one(boxes(edts.data, edts.end), "elst")!;
        need(elst, elst.data, 8);
        const version = bytes[elst.data],
          count = view.getUint32(elst.data + 4);
        if ((version !== 0 && version !== 1) || count < 1 || count > 2)
          invalid();
        const stride = version === 0 ? 12 : 20;
        need(elst, elst.data + 8, count * stride);
        for (let index = 0; index < count; index++) {
          const at = elst.data + 8 + index * stride;
          const rawDuration =
            version === 0 ? BigInt(view.getUint32(at)) : view.getBigUint64(at);
          const rawStart =
            version === 0
              ? BigInt(view.getInt32(at + 4))
              : view.getBigInt64(at + 8);
          if (
            rawDuration > BigInt(Number.MAX_SAFE_INTEGER) ||
            rawStart > BigInt(Number.MAX_SAFE_INTEGER) ||
            rawStart < -1n ||
            view.getInt16(at + stride - 4) !== 1 ||
            view.getInt16(at + stride - 2) !== 0
          )
            invalid();
          if (rawStart === -1n) {
            if (index !== 0 || count !== 2) invalid();
            emptyLead = Number(rawDuration) / movieTime.scale;
          } else {
            if (index !== count - 1) invalid();
            mediaStart = Number(rawStart) / mediaTime.scale;
            editDuration = Number(rawDuration) / movieTime.scale;
          }
        }
      }
      if (kind === "soun") {
        audioDuration = Math.max(
          audioDuration ?? 0,
          emptyLead + (editDuration ?? mediaTime.duration)
        );
        continue;
      }
      if (video) invalid(); // Multiple video tracks need an explicit selection contract.
      const tkhd = one(track, "tkhd")!;
      need(tkhd, tkhd.data, 4);
      const version = bytes[tkhd.data];
      if (version !== 0 && version !== 1) invalid();
      const matrix = tkhd.data + (version === 0 ? 40 : 52);
      need(tkhd, matrix, 44);
      const a = view.getInt32(matrix) / 65536,
        b = view.getInt32(matrix + 4) / 65536;
      const c = view.getInt32(matrix + 12) / 65536,
        d = view.getInt32(matrix + 16) / 65536;
      if (
        view.getInt32(matrix + 8) !== 0 ||
        view.getInt32(matrix + 20) !== 0 ||
        view.getInt32(matrix + 32) !== 1073741824
      )
        invalid();
      const rotations = [
        [1, 0, 0, 1],
        [0, 1, -1, 0],
        [-1, 0, 0, -1],
        [0, -1, 1, 0],
      ];
      const rotationIndex = rotations.findIndex(values =>
        values.every(
          (value, index) => Math.abs(value - [a, b, c, d][index]) < 0.0001
        )
      );
      if (rotationIndex < 0) invalid();
      const rotation = rotationIndex * 90;
      const minf = one(media, "minf")!;
      const stbl = one(boxes(minf.data, minf.end), "stbl")!;
      const samples = boxes(stbl.data, stbl.end);
      const stsd = one(samples, "stsd")!;
      need(stsd, stsd.data, 8);
      if (view.getUint32(stsd.data + 4) !== 1) invalid();
      const entries = boxes(stsd.data + 8, stsd.end);
      if (
        entries.length !== 1 ||
        !["avc1", "avc3", "hvc1", "hev1", "vp09", "av01", "mp4v"].includes(
          entries[0].type
        )
      )
        invalid();
      const entry = entries[0];
      need(entry, entry.data, 78);
      const width = view.getUint16(entry.data + 24),
        height = view.getUint16(entry.data + 26);
      if (!width || !height) invalid();
      const pasp = one(boxes(entry.data + 78, entry.end), "pasp", false);
      let pixelAspect = 1;
      if (pasp) {
        need(pasp, pasp.data, 8);
        pixelAspect = view.getUint32(pasp.data) / view.getUint32(pasp.data + 4);
        if (!(pixelAspect > 0 && pixelAspect < 100)) invalid();
      }
      let displayAspect = (width * pixelAspect) / height;
      if (rotation === 90 || rotation === 270)
        displayAspect = 1 / displayAspect;
      const stsz = one(samples, "stsz")!;
      need(stsz, stsz.data, 12);
      const frameCount = view.getUint32(stsz.data + 8);
      if (!frameCount || frameCount > MAX_ANALYSIS_FRAMES) invalid();
      if (!view.getUint32(stsz.data + 4))
        need(stsz, stsz.data + 12, frameCount * 4);
      const times = new Float64Array(frameCount);
      const table = (
        name: "stts" | "ctts",
        required: boolean,
        consume: (index: number, value: number) => void
      ) => {
        const box = one(samples, name, required);
        if (!box) return;
        need(box, box.data, 8);
        const version = bytes[box.data],
          count = view.getUint32(box.data + 4);
        if (
          (version !== 0 && !(name === "ctts" && version === 1)) ||
          count > frameCount
        )
          invalid();
        need(box, box.data + 8, count * 8);
        let index = 0;
        for (let row = 0; row < count; row++) {
          const at = box.data + 8 + row * 8,
            run = view.getUint32(at);
          const value =
            version === 1 ? view.getInt32(at + 4) : view.getUint32(at + 4);
          if (!run || index + run > frameCount || (name === "stts" && !value))
            invalid();
          for (let end = index + run; index < end; index++)
            consume(index, value);
        }
        if (index !== frameCount) invalid();
      };
      let decodeTime = 0;
      table("stts", true, (index, value) => {
        times[index] = decodeTime;
        decodeTime += value;
      });
      table("ctts", false, (index, value) => {
        times[index] += value;
      });
      const end = emptyLead + (editDuration ?? mediaTime.duration);
      for (let index = 0; index < frameCount; index++) {
        times[index] = times[index] / mediaTime.scale - mediaStart + emptyLead;
      }
      times.sort();
      for (let index = 0; index < frameCount; index++) {
        if (
          !Number.isFinite(times[index]) ||
          times[index] < -0.002 ||
          times[index] >= end ||
          (index > 0 && times[index] <= times[index - 1])
        )
          invalid();
      }
      // Every encoded frame must fall within the edit window. stts durations
      // belong to decode order; with B-frames they are not presentation holds.
      if (Math.abs(decodeTime / mediaTime.scale - mediaTime.duration) > 0.003)
        invalid();
      video = {
        duration: movieTime.duration,
        videoDuration: end,
        frameTimes: times,
        displayAspect,
        rotation,
        width,
        height,
      };
    }
    return video ? { ...video, audioDuration } : null;
  } catch {
    return null;
  }
}

/** Compare every presentation timestamp; an average frame rate cannot detect dropped/repeated frames. */
export function sameAnalysisVideoTiming(
  source: AnalysisVideoTiming,
  proxy: AnalysisVideoTiming
): boolean {
  if (
    source.frameTimes.length !== proxy.frameTimes.length ||
    source.frameTimes.length === 0 ||
    Math.abs(source.videoDuration - proxy.videoDuration) > 0.003 ||
    Math.abs(source.duration - proxy.duration) >
      Math.max(0.15, source.duration * 0.002) ||
    Math.abs(source.displayAspect / proxy.displayAspect - 1) > 0.005 ||
    (source.audioDuration !== null &&
      (proxy.audioDuration === null ||
        Math.abs(source.audioDuration - proxy.audioDuration) > 0.15))
  )
    return false;
  return source.frameTimes.every(
    (time, index) => Math.abs(time - proxy.frameTimes[index]) <= 0.001
  );
}

/** Read only headers and the bounded moov box, never a large original's media payload. */
export async function readMp4VideoTimingByRange(
  size: number,
  read: (offset: number, length: number) => Promise<ArrayBuffer | null>
): Promise<AnalysisVideoTiming | null> {
  if (!Number.isSafeInteger(size) || size < 16) return null;
  try {
    let offset = 0;
    let timing: AnalysisVideoTiming | null = null;
    for (let count = 0; offset < size && count < 64; count++) {
      const length = Math.min(16, size - offset);
      const header = await read(offset, length);
      if (!header || header.byteLength !== length || length < 8) return null;
      const view = new DataView(header),
        bytes = new Uint8Array(header);
      let boxSize = view.getUint32(0),
        headerSize = 8;
      if (boxSize === 1) {
        if (length < 16) return null;
        const large = view.getBigUint64(8);
        if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        boxSize = Number(large);
        headerSize = 16;
      } else if (boxSize === 0) boxSize = size - offset;
      if (boxSize < headerSize || offset + boxSize > size) return null;
      const type = String.fromCharCode(...bytes.subarray(4, 8));
      if (type === "moof") return null;
      if (type === "moov") {
        if (timing || boxSize > MAX_MP4_METADATA_BYTES) return null;
        const metadata = await read(offset, boxSize);
        timing =
          metadata?.byteLength === boxSize
            ? readMp4VideoTiming(metadata)
            : null;
        if (!timing) return null;
      }
      offset += boxSize;
    }
    return offset === size ? timing : null;
  } catch {
    /* Unsupported/missing source metadata remains unverified. */
  }
  return null;
}
