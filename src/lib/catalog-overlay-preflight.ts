import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import {
  exportDimensions,
  resolveExportSettings,
  type ExportSettings,
} from "@contracts/export-settings";
import { normalizeVisual } from "@contracts/clip-visual";
import { effectiveTimelineClips } from "@contracts/timeline-mixer";
import { isPrimaryFootage } from "@contracts/timeline-layers";
import { catalogEffectForAsset } from "@contracts/editor-effect-catalog";
import { normalizeSourceVisualEvidence } from "@contracts/source-visual-evidence";
import { protectedSourceBounds } from "@contracts/automatic-graphic-protection";
import {
  inspectSupportingMediaFrame,
  supportsPixelProtection,
  type DecodedProtectionLayer,
  type ProtectedMediaRegion,
  type SupportingMediaFinding,
} from "@contracts/supporting-media-protection";
import { serializeCubeLut, type CubeLut } from "@contracts/color-lut";
import { compareTimelineLayers } from "./timeline-lanes";
import { visualLayerSourceFilter } from "./visual-layer-rendering";
import {
  loadColorLut,
  colorLutFilename,
  prepareColorLutExport,
} from "./color-lut";
import {
  probeRenderSource,
  type RenderSourceMetadata,
} from "./render-source-probe";
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
} from "./platform-api";
import { withFfmpegLease } from "./ffmpeg-lease";

export const OVERLAY_PREFLIGHT_LIMITS = Object.freeze({
  frames: 1800,
  layers: 12,
  inputBytes: 256 * 1024 * 1024,
  totalInputBytes: 512 * 1024 * 1024,
  stagedBytes: 32 * 1024 * 1024,
  totalStagedBytes: 128 * 1024 * 1024,
  chunkBytes: 16 * 1024 * 1024,
  decodedBytes: 64 * 1024 * 1024,
  regionPixels: 120_000_000,
  milliseconds: 180_000,
});

export interface OverlayPixelEngine {
  mountAsset(name: string, blob: Blob): Promise<string>;
  exec(args: string[]): Promise<number>;
  ffprobe(args: string[]): Promise<number>;
  readFile(path: string, encoding?: "utf8"): Promise<Uint8Array | string>;
  writeFile(path: string, bytes: Uint8Array | string): Promise<void>;
  deleteFile(path: string): Promise<boolean>;
  dispose(): void;
}
export interface CatalogOverlayPreflightOptions {
  project: EditProject;
  assets: Asset[];
  operationClipIds: Readonly<Record<string, readonly string[]>>;
  signal: AbortSignal;
  settings?: Partial<ExportSettings>;
  onProgress?: (message: string) => void;
  /** Injection points for deterministic engine tests; normal callers omit. */
  createEngine?: (signal: AbortSignal) => Promise<OverlayPixelEngine>;
  loadAsset?: (asset: Asset, signal: AbortSignal) => Promise<Blob>;
}
export interface CatalogOverlayPreflightResult {
  checkedOperationIds: string[];
  blockedOperationIds: string[];
  unverifiedOperationIds: string[];
  findings: SupportingMediaFinding[];
  canvas: { width: number; height: number; frameRate: number };
  /** No persistent cache. A receipt may only describe this exact draft. */
  draftBinding: string;
}

export function catalogOverlayDraftBinding(
  options: Pick<
    CatalogOverlayPreflightOptions,
    "project" | "assets" | "operationClipIds" | "settings"
  >
) {
  const settings = resolveExportSettings(
    options.settings,
    options.project.frameRate
  );
  const usedAssets = new Set(options.project.clips.map(clip => clip.assetId));
  return bytesToHex(
    sha256(
      new TextEncoder().encode(
        JSON.stringify({
          settings,
          clips: options.project.clips,
          tracks: options.project.trackSettings,
          regions: options.project.sourceReviews,
          duration: options.project.duration,
          aspectRatio: options.project.aspectRatio,
          owners: options.operationClipIds,
          assets: options.assets
            .filter(a => usedAssets.has(a.id))
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(a => [
              a.id,
              a.kind,
              a.duration,
              a.width,
              a.height,
              a.size,
              a.createdAt,
              a.status,
              a.catalog?.media.sha256,
              a.catalog?.media.bytes,
              a.catalog?.alpha,
              a.variantGroupId,
              catalogEffectForAsset(a)?.sha256,
            ]),
        })
      )
    )
  );
}

async function browserEngine(signal: AbortSignal): Promise<OverlayPixelEngine> {
  const ffmpeg = new FFmpeg();
  let wasmUrl = "";
  const dispose = () => {
    signal.removeEventListener("abort", abort);
    ffmpeg.terminate();
    if (wasmUrl) {
      URL.revokeObjectURL(wasmUrl);
      wasmUrl = "";
    }
  };
  const abort = () => dispose();
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const core = await fetch("/vendor/render/core.bin", { signal });
    if (!core.ok || !core.body) throw new Error("Missing renderer");
    const blob = await new Response(
      core.body.pipeThrough(new DecompressionStream("gzip"))
    ).blob();
    signal.throwIfAborted();
    wasmUrl = URL.createObjectURL(
      new Blob([blob], { type: "application/wasm" })
    );
    await ffmpeg.load({
      classWorkerURL: new URL("/vendor/render/worker.js", location.origin).href,
      coreURL: new URL("/vendor/render/core.js", location.origin).href,
      wasmURL: wasmUrl,
    });
    signal.throwIfAborted();
    return {
      async mountAsset(name, data) {
        const directory = `/overlay-${name}`;
        await ffmpeg.createDir(directory);
        await ffmpeg.mount(
          FFFSType.WORKERFS,
          { blobs: [{ name: "source", data }] },
          directory
        );
        return `${directory}/source`;
      },
      exec: args => ffmpeg.exec(args),
      ffprobe: args => ffmpeg.ffprobe(args),
      readFile: (path, encoding) => ffmpeg.readFile(path, encoding),
      writeFile: async (path, bytes) => {
        await ffmpeg.writeFile(path, bytes);
      },
      deleteFile: path => ffmpeg.deleteFile(path),
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

const active = (clip: TimelineClip, time: number) =>
  time >= clip.start - 1e-7 && time < clip.start + clip.duration - 1e-7;
const firstFrame = (time: number, fps: number) => Math.ceil(time * fps - 1e-7);
const picture = (clip: TimelineClip) =>
  !clip.hidden &&
  !clip.graphic &&
  clip.track !== "audio" &&
  clip.track !== "captions";

/** Exact source chain into a bounded lossless intermediate. Keeping transforms
 * out of the per-chunk pass avoids re-rendering the source prefix repeatedly. */
export function overlayStageArguments(
  clip: TimelineClip,
  asset: Asset,
  input: string,
  output: string,
  canvas: { width: number; height: number; frameRate: number },
  metadata?: RenderSourceMetadata,
  luts: ReadonlyMap<string, CubeLut> = new Map()
) {
  return [
    "-y",
    "-v",
    "error",
    "-filter_complex_threads",
    "1",
    "-threads",
    "1",
    ...(asset.kind === "image"
      ? ["-loop", "1", "-framerate", String(canvas.frameRate)]
      : []),
    ...(asset.catalog?.alpha ? ["-c:v", "libvpx-vp9"] : []),
    "-i",
    input,
    "-an",
    "-vf",
    `${visualLayerSourceFilter(clip, canvas, { scope: 0, still: asset.kind === "image", metadata, colorLuts: luts })},setpts=PTS-STARTPTS,format=bgra`,
    "-frames:v",
    String(firstFrame(clip.duration, canvas.frameRate)),
    "-c:v",
    "ffv1",
    "-level",
    "3",
    "-g",
    "1",
    "-pix_fmt",
    "bgra",
    "-f",
    "matroska",
    "-fs",
    String(OVERLAY_PREFLIGHT_LIMITS.stagedBytes),
    output,
  ];
}

export function overlayChunkArguments(
  input: string,
  output: string,
  start: number,
  count: number
) {
  return [
    "-y",
    "-v",
    "error",
    "-threads",
    "1",
    "-i",
    input,
    "-an",
    "-vf",
    `trim=start_frame=${start}:end_frame=${start + count},setpts=PTS-STARTPTS,format=rgba`,
    "-frames:v",
    String(count),
    "-vsync",
    "0",
    "-f",
    "rawvideo",
    output,
  ];
}

export async function preflightCatalogOverlays(
  options: CatalogOverlayPreflightOptions
): Promise<CatalogOverlayPreflightResult> {
  return withFfmpegLease(options.signal, () => runPreflight(options));
}

async function runPreflight(
  options: CatalogOverlayPreflightOptions
): Promise<CatalogOverlayPreflightResult> {
  const { project, assets, operationClipIds } = options;
  const settings = resolveExportSettings(options.settings, project.frameRate);
  const canvas = {
    ...exportDimensions(project.aspectRatio, settings.resolution),
    frameRate: settings.frameRate,
  };
  const ids = Object.keys(operationClipIds);
  const findings = new Map<string, SupportingMediaFinding>();
  const add = (f: SupportingMediaFinding) => {
    const key = `${f.operationId}:${f.reason}:${f.sourceClipId ?? ""}:${f.regionId ?? ""}`;
    if (!findings.has(key)) findings.set(key, f);
  };
  const result = (): CatalogOverlayPreflightResult => {
    const all = [...findings.values()];
    const blocked = ids.filter(id =>
      all.some(f => f.operationId === id && f.reason === "source-obscured")
    );
    const unverified = ids.filter(id =>
      all.some(f => f.operationId === id && f.reason !== "source-obscured")
    );
    return {
      checkedOperationIds: ids.filter(
        id => !blocked.includes(id) && !unverified.includes(id)
      ),
      blockedOperationIds: blocked,
      unverifiedOperationIds: unverified,
      findings: all,
      canvas,
      draftBinding: catalogOverlayDraftBinding(options),
    };
  };
  const failAll = (
    reason: SupportingMediaFinding["reason"],
    detail: string
  ) => {
    for (const id of ids)
      add({
        operationId: id,
        clipId: operationClipIds[id][0] ?? "",
        reason,
        detail,
      });
  };
  options.signal.throwIfAborted();
  if (!ids.length) return result();
  const deadline = AbortSignal.timeout(OVERLAY_PREFLIGHT_LIMITS.milliseconds);
  const signal = AbortSignal.any([options.signal, deadline]);
  const checkpoint = () => signal.throwIfAborted();
  let engine: OverlayPixelEngine | undefined;
  try {
    const clips = effectiveTimelineClips(project)
      .filter(picture)
      .sort(compareTimelineLayers);
    const owners = new Map<string, string>();
    for (const [id, clipIds] of Object.entries(operationClipIds)) {
      if (
        !clipIds.length ||
        clipIds.some(
          clipId => !clips.some(c => c.id === clipId) || owners.has(clipId)
        )
      )
        throw new Error("Unbound overlay owner");
      for (const clipId of clipIds) owners.set(clipId, id);
    }
    const targets = clips.filter(c => owners.has(c.id) && !c.transitionHandle);
    if (targets.length !== owners.size) throw new Error("Unbound overlay clip");
    const byAsset = new Map(assets.map(a => [a.id, a]));
    for (const clip of targets) {
      const asset = byAsset.get(clip.assetId ?? "");
      if (
        !asset ||
        (!asset.catalog && !catalogEffectForAsset(asset)) ||
        !["image", "video"].includes(asset.kind) ||
        asset.status !== "ready" ||
        !supportsPixelProtection(normalizeVisual(clip.visual).blendMode)
      )
        throw new Error("Unsupported catalog pixels");
    }
    const frameSet = new Set<number>();
    for (const clip of targets) {
      if (
        ![clip.start, clip.duration, clip.inPoint].every(Number.isFinite) ||
        clip.start < 0 ||
        clip.duration <= 0
      )
        throw new Error("Invalid overlay clock");
      const start = firstFrame(clip.start, canvas.frameRate),
        end = firstFrame(
          Math.min(project.duration, clip.start + clip.duration),
          canvas.frameRate
        );
      if (end - start > OVERLAY_PREFLIGHT_LIMITS.frames)
        throw new RangeError("Frame limit");
      for (let frame = start; frame < end; frame++) frameSet.add(frame);
    }
    if (frameSet.size > OVERLAY_PREFLIGHT_LIMITS.frames)
      throw new RangeError("Frame limit");
    const frames = [...frameSet].sort((a, b) => a - b);
    const sources = clips.flatMap((clip, order) => {
      if (
        owners.has(clip.id) ||
        (!clip.transitionHandle &&
          !isPrimaryFootage(clip) &&
          !project.sourceReviews?.some(r => r.assetId === clip.assetId))
      )
        return [];
      const asset = byAsset.get(clip.assetId ?? "");
      const review = project.sourceReviews
        ?.filter(r => r.assetId === clip.assetId)
        .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0];
      return [
        {
          clip,
          order,
          asset,
          evidence: normalizeSourceVisualEvidence(
            review?.visualProtection,
            asset?.duration
          ),
        },
      ];
    });
    const regionsByFrame = new Map<number, ProtectedMediaRegion[]>();
    let examinedPixels = 0;
    for (const frame of frames) {
      checkpoint();
      const time = frame / canvas.frameRate;
      const regions: ProtectedMediaRegion[] = [];
      for (const source of sources) {
        if (!active(source.clip, time)) continue;
        const above = targets.filter(
          c => active(c, time) && clips.indexOf(c) > source.order
        );
        if (!above.length) continue;
        const sourceTime =
          source.clip.inPoint +
          (time - source.clip.start) * (source.clip.speed ?? 1);
        if (
          source.evidence.coverage === "unknown" ||
          !source.asset?.width ||
          !source.asset.height ||
          !source.evidence.reviewedRanges.some(
            r => sourceTime >= r.start - 1e-7 && sourceTime < r.end
          )
        ) {
          for (const clip of above)
            add({
              operationId: owners.get(clip.id)!,
              clipId: clip.id,
              sourceClipId: source.clip.id,
              time,
              reason: "unknown-source-layout",
              detail:
                "Saved spatial evidence does not cover this source interval.",
            });
          continue;
        }
        for (const region of source.evidence.regions) {
          if (sourceTime < region.start || sourceTime >= region.end) continue;
          const rect = protectedSourceBounds(
            source.clip,
            time,
            region.rect,
            { width: source.asset.width, height: source.asset.height },
            canvas
          );
          if (!rect) continue;
          examinedPixels +=
            Math.ceil(
              Math.max(
                0,
                Math.min(canvas.width, rect.x + rect.width) -
                  Math.max(0, rect.x)
              )
            ) *
            Math.ceil(
              Math.max(
                0,
                Math.min(canvas.height, rect.y + rect.height) -
                  Math.max(0, rect.y)
              )
            );
          if (examinedPixels > OVERLAY_PREFLIGHT_LIMITS.regionPixels)
            throw new RangeError("Pixel limit");
          regions.push({
            sourceClipId: source.clip.id,
            regionId: region.id,
            kind: region.kind,
            sourceOrder: source.order,
            rect,
          });
        }
      }
      if (regions.length) regionsByFrame.set(frame, regions);
    }
    if (!regionsByFrame.size) return result();
    const needed = clips.filter((clip, order) =>
      [...regionsByFrame].some(
        ([frame, regions]) =>
          active(clip, frame / canvas.frameRate) &&
          regions.some(r => order > r.sourceOrder)
      )
    );
    if (needed.length > OVERLAY_PREFLIGHT_LIMITS.layers)
      throw new RangeError("Layer limit");
    if (
      canvas.width * canvas.height * 4 * needed.length >
      OVERLAY_PREFLIGHT_LIMITS.decodedBytes
    )
      throw new RangeError("Decoded pixel limit");
    if (
      needed.some(
        c => !supportsPixelProtection(normalizeVisual(c.visual).blendMode)
      )
    )
      throw new Error("Unsupported blend");
    options.onProgress?.(
      "Checking supporting media against protected source content…"
    );
    engine = await (options.createEngine ?? browserEngine)(signal);
    checkpoint();
    const scope = options.loadAsset
      ? undefined
      : await captureUploadRequestScope();
    const mounted = new Map<
      string,
      { path: string; metadata: RenderSourceMetadata }
    >();
    const staged = new Map<string, string>();
    const luts = new Map<string, CubeLut>();
    let inputBytes = 0,
      stagedBytes = 0;
    for (const [index, clip] of needed.entries()) {
      checkpoint();
      const asset = byAsset.get(clip.assetId ?? "");
      if (
        !asset ||
        asset.status !== "ready" ||
        firstFrame(clip.duration, canvas.frameRate) >
          OVERLAY_PREFLIGHT_LIMITS.frames
      )
        throw new RangeError("Unavailable layer");
      if (!mounted.has(asset.id)) {
        const blob = await (options.loadAsset
          ? options.loadAsset(asset, signal)
          : platformApi.downloadAssetBlob(asset.id, signal, {
              scope,
              maxBytes: OVERLAY_PREFLIGHT_LIMITS.inputBytes,
            }));
        checkpoint();
        inputBytes += blob.size;
        if (
          blob.size > OVERLAY_PREFLIGHT_LIMITS.inputBytes ||
          inputBytes > OVERLAY_PREFLIGHT_LIMITS.totalInputBytes
        )
          throw new RangeError("Input limit");
        const hash = sha256.create();
        const reader = blob.stream().getReader();
        try {
          for (;;) {
            checkpoint();
            const next = await reader.read();
            if (next.done) break;
            hash.update(next.value);
          }
        } finally {
          reader.releaseLock();
        }
        const digest = bytesToHex(hash.digest());
        const expected = asset.catalog?.media ?? catalogEffectForAsset(asset);
        if (
          expected &&
          (digest !== expected.sha256 || blob.size !== expected.bytes)
        )
          throw new Error("Catalog digest mismatch");
        if (scope) await verifyUploadRequestScope(scope);
        checkpoint();
        const path = await engine.mountAsset(String(index), blob);
        mounted.set(asset.id, {
          path,
          metadata: await probeRenderSource(engine, path),
        });
      }
      if (
        clip.colorLut &&
        clip.colorLut.amount > 0 &&
        !luts.has(clip.colorLut.sha256)
      ) {
        const lut = await loadColorLut(clip.colorLut, signal);
        luts.set(clip.colorLut.sha256, lut);
        await engine.writeFile(
          colorLutFilename(clip.colorLut),
          serializeCubeLut(prepareColorLutExport(clip.colorLut, lut))
        );
      }
      const source = mounted.get(asset.id)!;
      const file = `overlay-stage-${index}.mkv`;
      if (
        (await engine.exec(
          overlayStageArguments(
            clip,
            asset,
            source.path,
            file,
            canvas,
            source.metadata,
            luts
          )
        )) !== 0
      )
        throw new Error("Overlay render failed");
      checkpoint();
      const encoded = await engine.readFile(file);
      if (
        typeof encoded === "string" ||
        !encoded.length ||
        encoded.length >= OVERLAY_PREFLIGHT_LIMITS.stagedBytes
      )
        throw new RangeError("Staging limit");
      stagedBytes += encoded.length;
      if (stagedBytes > OVERLAY_PREFLIGHT_LIMITS.totalStagedBytes)
        throw new RangeError("Staging limit");
      staged.set(clip.id, file);
    }
    const bytesPerFrame = canvas.width * canvas.height * 4;
    const chunkFrames = Math.max(
      1,
      Math.floor(
        OVERLAY_PREFLIGHT_LIMITS.chunkBytes / (bytesPerFrame * needed.length)
      )
    );
    const requiredFrames = [...regionsByFrame.keys()];
    for (let offset = 0; offset < requiredFrames.length;) {
      checkpoint();
      const start = requiredFrames[offset];
      let count = 1;
      while (
        count < chunkFrames &&
        requiredFrames[offset + count] === start + count
      )
        count++;
      const buffers = new Map<
        string,
        { bytes: Uint8Array; globalStart: number }
      >();
      for (const clip of needed) {
        const begin = Math.max(start, firstFrame(clip.start, canvas.frameRate));
        const end = Math.min(
          start + count,
          firstFrame(clip.start + clip.duration, canvas.frameRate)
        );
        if (end <= begin) continue;
        const localStart = begin - firstFrame(clip.start, canvas.frameRate);
        const file = "overlay-chunk.rgba";
        try {
          if (
            (await engine.exec(
              overlayChunkArguments(
                staged.get(clip.id)!,
                file,
                localStart,
                end - begin
              )
            )) !== 0
          )
            throw new Error("Pixel decoding failed");
          checkpoint();
          const bytes = await engine.readFile(file);
          if (
            typeof bytes === "string" ||
            bytes.length !== bytesPerFrame * (end - begin)
          )
            throw new Error("Incomplete delivery frames");
          buffers.set(clip.id, { bytes, globalStart: begin });
        } finally {
          await engine.deleteFile(file).catch(() => false);
        }
      }
      for (let frame = start; frame < start + count; frame++) {
        const layers: DecodedProtectionLayer[] = needed.flatMap(clip => {
          const value = buffers.get(clip.id);
          if (!value || !active(clip, frame / canvas.frameRate)) return [];
          const first = (frame - value.globalStart) * bytesPerFrame;
          return [
            {
              clipId: clip.id,
              operationId: owners.get(clip.id),
              order: clips.indexOf(clip),
              blendMode: normalizeVisual(clip.visual)
                .blendMode as DecodedProtectionLayer["blendMode"],
              rgba: value.bytes.subarray(first, first + bytesPerFrame),
            },
          ];
        });
        for (const finding of inspectSupportingMediaFrame(
          canvas,
          frame / canvas.frameRate,
          regionsByFrame.get(frame)!,
          layers,
          checkpoint
        ))
          add(finding);
      }
      offset += count;
    }
    checkpoint();
    if (scope) await verifyUploadRequestScope(scope);
  } catch (error) {
    options.signal.throwIfAborted();
    failAll(
      error instanceof RangeError || deadline.aborted
        ? "resource-limit"
        : "unverified-pixels",
      error instanceof RangeError || deadline.aborted
        ? "The selected composition exceeds the bounded pixel-check budget."
        : "The complete source-bound overlay pixels could not be verified."
    );
  } finally {
    engine?.dispose();
  }
  return result();
}
