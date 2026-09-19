import { captionAssStyle, captionAssEvents } from "./caption-rendering";
import { compareTimelineLayers } from "@/lib/timeline-lanes";
import type { Asset, EditProject } from "@contracts/workspace";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { graphicAssEvents } from "./graphic-ass";

const number = (n: number) => Number(n.toFixed(4));
/** Pure, deterministic FFmpeg plan, also exercised against native FFmpeg. */
export function buildRenderPlan(
  project: EditProject,
  assets: Asset[],
  audioIds: Set<string>,
  resolution: 720 | 1080 = 720
) {
  const mediaClips = project.clips
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
  const landscape = Math.round((resolution * 16) / 9 / 2) * 2;
  const [width, height] =
    project.aspectRatio === "16:9"
      ? [landscape, resolution]
      : project.aspectRatio === "1:1"
        ? [resolution, resolution]
        : [resolution, landscape];
  const args: string[] = ["-y", "-filter_complex_threads", "1"];
  const filters = [
    `color=c=black:s=${width}x${height}:r=30:d=${number(duration)}[base]`,
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
    if (asset.kind === "image") args.push("-loop", "1", "-framerate", "30");
    args.push("-i", `input-${inputs.indexOf(asset)}`);
    const end = number(clip.inPoint + clip.duration * speed);
    const trim = `start=${number(clip.inPoint)}:end=${end}`;
    if (clip.track !== "audio" && asset.kind !== "audio") {
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
      const grade = `eq=brightness=${bounded(clip.brightness, 0, -0.5, 0.5)}:contrast=${bounded(clip.contrast, 1, 0.5, 2)}:saturation=${bounded(clip.saturation, 1, 0, 3)}`;
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
        `[${index}:v]trim=${trim},setpts=(PTS-STARTPTS)/${speed},format=rgba,${fit},setsar=1,fps=30,${grade}${fades ? `,${fades}` : ""},setpts=PTS+${number(clip.start)}/TB[v${index}]`
      );
      filters.push(
        `[${visual}][v${index}]overlay=eof_action=pass:repeatlast=0:enable='gte(t,${number(clip.start)})*lt(t,${number(clip.start + clip.duration)})'[layer${index}]`
      );
      visual = `layer${index}`;
    }
    if (audioIds.has(asset.id) && !clip.muted && volume > 0) {
      const tempo =
        speed < 0.5
          ? `atempo=0.5,atempo=${speed / 0.5}`
          : speed > 2
            ? `atempo=2,atempo=${speed / 2}`
            : `atempo=${speed}`;
      filters.push(
        `[${index}:a]atrim=${trim},asetpts=PTS-STARTPTS,${tempo},volume=${volume}${clip.fadeIn ? `,afade=t=in:st=0:d=${number(Math.min(clip.duration, clip.fadeIn))}` : ""}${clip.fadeOut ? `,afade=t=out:st=${number(Math.max(0, clip.duration - clip.fadeOut))}:d=${number(Math.min(clip.duration, clip.fadeOut))}` : ""},aresample=48000,adelay=${Math.round(clip.start * 1000)}:all=1[a${index}]`
      );
      audio.push(`a${index}`);
    }
  });
  const captions = project.transcript.filter(
    s => s.text.trim() && s.end > s.start && s.start < duration
  );
  const graphics = graphicAssEvents(project.clips, width, height, duration);
  const ass =
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,DejaVu Sans,${Math.round(width / 22)},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,40,40,${Math.round(height * 0.14)},1\nStyle: Callout,DejaVu Sans,${Math.round(width / 22)},&H00FFFFFF,&H00FFFFFF,&H006F5AD8,&H006F5AD8,-1,0,0,0,100,100,0,0,3,8,0,5,0,0,0,1\n${captionAssStyle(project.captionStyle, width, height)}\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n` +
    captionAssEvents(captions, project.captionStyle, duration) +
    "\n" +
    graphics;
  if (captions.length || graphics) {
    filters.push(`[${visual}]subtitles=captions.ass:fontsdir=.[video]`);
    visual = "video";
  }
  filters.push(
    `${audio.map(a => `[${a}]`).join("")}amix=inputs=${audio.length}:normalize=0:duration=longest,alimiter=limit=0.95,atrim=duration=${number(duration)}[audio]`
  );
  const videoRate = resolution === 720 ? 6_000_000 : 12_000_000;
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${visual}]`,
    "-map",
    "[audio]",
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
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-t",
    String(number(duration)),
    "-movflags",
    "+faststart",
    "output.mp4"
  );
  return { args, inputs, ass, duration, width, height };
}
