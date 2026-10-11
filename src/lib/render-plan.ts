import { colorGradeFilter } from "./color-grade";
import { visualRenderFilter, visualCompositeFilters } from "./visual-rendering";
import { captionAssStyle, captionAssEvents } from "./caption-rendering";
import { compareTimelineLayers } from "@/lib/timeline-lanes";
import type { Asset, EditProject } from "@contracts/workspace";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { graphicAssEvents } from "./graphic-ass";
import { audioMixFilter } from "@contracts/audio-mix";
import { timelineTrackGain } from "@contracts/timeline-mixer";
import {
  exportDimensions,
  exportFileType,
  resolveExportSettings,
  type ExportResolution,
  type ExportSettings,
} from "@contracts/export-settings";
import { effectiveTimelineClips } from "@contracts/timeline-mixer";

const number = (n: number) => Number(n.toFixed(4));
/** Pure, deterministic FFmpeg plan, also exercised against native FFmpeg. */
export function buildRenderPlan(
  project: EditProject,
  assets: Asset[],
  audioIds: Set<string>,
  options: ExportResolution | Partial<ExportSettings> = 720
) {
  const { resolution, frameRate, format } = resolveExportSettings(
    options,
    project.frameRate
  );
  const fileType = exportFileType(format);
  const effectiveClips = effectiveTimelineClips(project);
  const mediaClips = effectiveClips
    .filter(c => c.track !== "captions" && !c.graphic)
    .sort(compareTimelineLayers);
  if (!mediaClips.length && !project.clips.some(c => c.graphic))
    throw new Error("Add media to your timeline first.");
  const duration = project.duration;
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("Choose a positive video duration.");
  for (const clip of project.clips.filter(c => c.graphic)) {
    if (
      !normalizeGraphic(clip.graphic) ||
      ![clip.start, clip.duration].every(Number.isFinite) ||
      clip.start < 0 ||
      clip.duration <= 0
    )
      throw new Error(
        "A graphic has invalid settings or timing. Review it before exporting."
      );
  }
  const sources = new Map(assets.map(a => [a.id, a]));
  const used = [...new Set(mediaClips.map(c => c.assetId))].map(id =>
    sources.get(id || "")
  );
  if (
    used.some(
      a =>
        !a ||
        a.status !== "ready" ||
        !["video", "audio", "image", "export"].includes(a.kind)
    )
  )
    throw new Error(
      "Some timeline media is missing or still processing. Replace it before exporting."
    );
  const inputs = used as Asset[];
  const { width, height } = exportDimensions(project.aspectRatio, resolution);
  const args: string[] = ["-y", "-filter_complex_threads", "1"];
  const filters = [
    `color=c=black:s=${width}x${height}:r=${frameRate}:d=${number(duration)}[base]`,
    `anullsrc=r=48000:cl=stereo,atrim=duration=${number(duration)}[silence]`,
  ];
  let visual = "base";
  const audio = ["silence"];
  mediaClips.forEach((clip, index) => {
    const asset = sources.get(clip.assetId!)!;
    const speed = clip.speed ?? 1;
    const volume =
      (clip.volume ?? 1) > 2 ? (clip.volume ?? 100) / 100 : (clip.volume ?? 1);
    if (
      ![clip.start, clip.duration, clip.inPoint, speed, volume].every(
        Number.isFinite
      ) ||
      clip.start < 0 ||
      clip.duration <= 0 ||
      clip.inPoint < 0 ||
      speed < 0.25 ||
      speed > 4 ||
      volume < 0 ||
      volume > 2
    )
      throw new Error(
        "A clip has invalid timing, speed, or volume. Review the timeline."
      );
    if (asset.kind === "image")
      args.push("-loop", "1", "-framerate", String(frameRate));
    args.push("-i", `input-${inputs.indexOf(asset)}`);
    const end = number(clip.inPoint + clip.duration * speed);
    const trim = `start=${number(clip.inPoint)}:end=${end}`;
    if (!clip.hidden && clip.track !== "audio" && asset.kind !== "audio") {
      const fit =
        clip.fit === "cover"
          ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
          : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0`;
      const bounded = (
        value: number | undefined,
        fallback: number,
        min: number,
        max: number
      ) =>
        Number.isFinite(value)
          ? Math.min(max, Math.max(min, value!))
          : fallback;
      const grade = colorGradeFilter(clip);
      const transform = visualRenderFilter(clip, { width, height });
      const fades = [
        clip.fadeIn
          ? `fade=t=in:st=0:d=${number(Math.min(clip.duration, bounded(clip.fadeIn, 0, 0, 5)))}:alpha=1`
          : "",
        clip.fadeOut
          ? `fade=t=out:st=${number(Math.max(0, clip.duration - bounded(clip.fadeOut, 0, 0, 5)))}:d=${number(Math.min(clip.duration, bounded(clip.fadeOut, 0, 0, 5)))}:alpha=1`
          : "",
      ]
        .filter(Boolean)
        .join(",");
      filters.push(
        `[${index}:v]trim=${trim},setpts=(PTS-STARTPTS)/${speed},format=rgba,${fit},setsar=1,fps=${frameRate},${grade}${transform ? `,${transform}` : ""}${fades ? `,${fades}` : ""},setpts=PTS+${number(clip.start)}/TB[v${index}]`
      );
      filters.push(
        ...visualCompositeFilters(clip, visual, `v${index}`, `layer${index}`)
      );
      visual = `layer${index}`;
    }
    if (audioIds.has(asset.id) && !clip.muted && volume > 0) {
      const tempo =
        speed < 0.5
          ? `atempo=0.5,atempo=${speed / 0.5}`
          : speed > 2
            ? `atempo=2,atempo=${speed / 2}`
            : speed === 1
              ? ""
              : `atempo=${speed}`;
      filters.push(
        `[${index}:a]atrim=${trim},asetpts=PTS-STARTPTS,${tempo ? `${tempo},` : ""}${audioMixFilter(clip, timelineTrackGain(project, clip))},aresample=48000,adelay=${Math.round(clip.start * 1000)}:all=1[a${index}]`
      );
      audio.push(`a${index}`);
    }
  });
  const captions = project.transcript.filter(
    s => s.text.trim() && s.end > s.start && s.start < duration
  );
  const graphics = graphicAssEvents(effectiveClips, width, height, duration);
  const ass =
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,DejaVu Sans,${Math.round(width / 22)},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,40,40,${Math.round(height * 0.14)},1\nStyle: Callout,DejaVu Sans,${Math.round(width / 22)},&H00FFFFFF,&H00FFFFFF,&H006F5AD8,&H006F5AD8,-1,0,0,0,100,100,0,0,3,8,0,5,0,0,0,1\n${captionAssStyle(project.captionStyle, width, height, project.captionAppearance)}\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n` +
    captionAssEvents(
      captions,
      project.captionStyle,
      duration,
      project.captionAppearance,
      { width, height, frameRate }
    ) +
    "\n" +
    graphics;
  if (captions.length || graphics) {
    filters.push(`[${visual}]subtitles=captions.ass:fontsdir=.[video]`);
    visual = "video";
  }
  filters.push(
    `${audio.map(a => `[${a}]`).join("")}amix=inputs=${audio.length}:normalize=0:duration=longest,alimiter=limit=0.95,atrim=duration=${number(duration)}[audio]`
  );
  const videoRate =
    resolution === 720
      ? 6_000_000
      : resolution === 1080
        ? 12_000_000
        : 40_000_000;
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${visual}]`,
    "-map",
    "[audio]",
    "-r",
    String(frameRate),
    ...(format === "mp4"
      ? [
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "20",
          "-maxrate",
          String(videoRate),
          "-bufsize",
          String(videoRate * 2),
        ]
      : // VP8 is verified in the shipped single-thread WASM core. Its VP9 encoder crashes.
        [
          "-c:v",
          "libvpx",
          "-threads",
          "1",
          "-deadline",
          "realtime",
          "-cpu-used",
          "8",
          "-b:v",
          String(videoRate),
        ]),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    // The shipped Opus encoder crashes on non-silent stereo; Vorbis fully decodes.
    format === "mp4" ? "aac" : "libvorbis",
    "-b:a",
    "128k",
    "-t",
    String(number(duration)),
    ...(format === "mp4" ? ["-movflags", "+faststart"] : ["-f", "webm"]),
    fileType.filename
  );
  return {
    args,
    inputs,
    ass,
    duration,
    width,
    height,
    resolution,
    frameRate,
    format,
    ...fileType,
  };
}
