import type { ExportFormat, ExportFrameRate } from "@contracts/export-settings";

export interface ExpectedExportMetadata {
  width: number;
  height: number;
  duration: number;
  frameRate?: ExportFrameRate;
  format?: ExportFormat;
  filename?: string;
}
const verificationError = () =>
  new Error(
    "The exported video did not pass its duration, picture, frame rate and format checks. Your project is saved; please retry export."
  );
function frameRate(value: unknown) {
  if (typeof value !== "string") return NaN;
  const match = /^(\d+)\/(\d+)$/.exec(value);
  return match && Number(match[2]) > 0
    ? Number(match[1]) / Number(match[2])
    : NaN;
}
function taggedDuration(value: unknown) {
  if (typeof value !== "string") return NaN;
  const match = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value);
  return match
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : NaN;
}

/** Validate the encoded file's metadata, never substitute the requested render settings. */
export function verifyExportMetadata(
  value: unknown,
  expected: ExpectedExportMetadata
): { width: number; height: number; duration: number } {
  const probe =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const video = streams.find(s => s && s.codec_type === "video");
  const format =
    probe.format && typeof probe.format === "object"
      ? (probe.format as Record<string, unknown>)
      : {};
  const duration = Number(format.duration);
  const videoDuration =
    video?.duration === undefined
      ? taggedDuration(video?.tags?.DURATION)
      : Number(video.duration);
  const names =
    typeof format.format_name === "string" ? format.format_name.split(",") : [];
  const codecs = expected.format === "webm" ? ["vp8"] : ["h264"];
  const audio = streams.filter(s => s && s.codec_type === "audio");
  if (
    !video ||
    !codecs.includes(video.codec_name) ||
    video.width !== expected.width ||
    video.height !== expected.height ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(videoDuration) ||
    videoDuration <= 0 ||
    Math.abs(duration - expected.duration) > 0.15 ||
    Math.abs(videoDuration - expected.duration) > 0.15 ||
    (expected.format !== undefined &&
      (!names.includes(expected.format) ||
        audio.some(
          s => s.codec_name !== (expected.format === "mp4" ? "aac" : "vorbis")
        ))) ||
    (expected.frameRate !== undefined &&
      (Math.abs(frameRate(video.avg_frame_rate) - expected.frameRate) >
        0.00001 ||
        Math.abs(frameRate(video.r_frame_rate) - expected.frameRate) >
          0.00001 ||
        !Number.isFinite(frameRate(video.avg_frame_rate)) ||
        !Number.isFinite(frameRate(video.r_frame_rate))))
  ) {
    throw verificationError();
  }
  return { width: video.width, height: video.height, duration };
}

/** The shared Matroska demuxer name alone cannot distinguish WebM from MKV. */
export function verifyExportContainer(bytes: Uint8Array, format: ExportFormat) {
  if (format === "mp4") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (
      bytes.length < 16 ||
      new TextDecoder().decode(bytes.subarray(4, 8)) !== "ftyp"
    )
      throw verificationError();
    const end = view.getUint32(0);
    if (end < 16 || end > bytes.length) throw verificationError();
    const brands = [new TextDecoder().decode(bytes.subarray(8, 12))];
    for (let i = 16; i + 4 <= end; i += 4)
      brands.push(new TextDecoder().decode(bytes.subarray(i, i + 4)));
    if (
      !brands.some(brand =>
        ["isom", "iso2", "mp41", "mp42", "avc1"].includes(brand)
      )
    )
      throw verificationError();
    return;
  }
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x1a ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0xdf ||
    bytes[3] !== 0xa3
  )
    throw verificationError();
  function vint(at: number, keepMarker = false) {
    let length = 1,
      marker = 0x80;
    while (length <= 8 && !(bytes[at] & marker)) {
      length++;
      marker >>= 1;
    }
    if (length > 8 || at + length > bytes.length) throw verificationError();
    let value = bytes[at] & (keepMarker ? 0xff : marker - 1);
    for (let i = 1; i < length; i++) value = value * 256 + bytes[at + i];
    if (!Number.isSafeInteger(value)) throw verificationError();
    return { length, value };
  }
  const header = vint(4),
    end = 4 + header.length + header.value;
  if (end > bytes.length || header.value > 4096) throw verificationError();
  for (let at = 4 + header.length; at < end;) {
    const id = vint(at, true);
    at += id.length;
    const size = vint(at);
    at += size.length;
    if (at + size.value > end) throw verificationError();
    if (id.value === 0x4282) {
      if (
        new TextDecoder().decode(bytes.subarray(at, at + size.value)) !== "webm"
      )
        throw verificationError();
      return;
    }
    at += size.value;
  }
  throw verificationError();
}
