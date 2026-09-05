import type { Asset, EditProject } from "@contracts/workspace";

export const RENDER_MAX_SECONDS = 180;
export const RENDER_MAX_INPUT_BYTES = 160 * 1024 * 1024;

const number = (n: number) => Number(n.toFixed(4));
function time(seconds: number) {
  const cs = Math.round(Math.max(0, seconds) * 100);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

/** Pure, deterministic FFmpeg plan, also exercised against native FFmpeg. */
export function buildRenderPlan(
  project: EditProject,
  assets: Asset[],
  audioIds: Set<string>,
  resolution: 720 | 1080 = 720
) {
  const mediaClips = project.clips.filter(c => c.track !== "captions");
  if (!mediaClips.length) throw new Error("Add media to your timeline first.");
  if (mediaClips.length > 40)
    throw new Error(
      "Export supports up to 40 media clips. Split this project into shorter videos."
    );
  const duration = Math.max(...mediaClips.map(c => c.start + c.duration));
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > RENDER_MAX_SECONDS
  )
    throw new Error("Export a timeline between 1 and 180 seconds.");
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
  if (inputs.reduce((sum, a) => sum + a.size, 0) > RENDER_MAX_INPUT_BYTES)
    throw new Error(
      "This export uses too much source media. Use smaller files or split the project."
    );
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
    const volume = clip.volume ?? 1;
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
      filters.push(
        `[${index}:v]trim=${trim},setpts=(PTS-STARTPTS)/${speed}+${number(clip.start)}/TB,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${index}]`
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
        `[${index}:a]atrim=${trim},asetpts=PTS-STARTPTS,${tempo},volume=${volume},aresample=48000,adelay=${Math.round(clip.start * 1000)}:all=1[a${index}]`
      );
      audio.push(`a${index}`);
    }
  });
  const captions = project.transcript.filter(
    s => s.text.trim() && s.end > s.start && s.start < duration
  );
  const ass =
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,DejaVu Sans,${Math.round(width / 22)},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,40,40,${Math.round(height * 0.14)},1\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n` +
    captions
      .map(
        s =>
          `Dialogue: 0,${time(s.start)},${time(Math.min(duration, s.end))},Default,,0,0,0,,${s.text.replace(/[{}\\]/g, "").replace(/\r?\n/g, "\\N")}`
      )
      .join("\n");
  if (captions.length) {
    filters.push(`[${visual}]subtitles=captions.ass:fontsdir=.[video]`);
    visual = "video";
  }
  filters.push(
    `${audio.map(a => `[${a}]`).join("")}amix=inputs=${audio.length}:normalize=0:duration=longest,alimiter=limit=0.95,atrim=duration=${number(duration)}[audio]`
  );
  const videoRate = Math.max(
    250000,
    Math.min(
      resolution === 720 ? 4000000 : 8000000,
      Math.floor(((22 * 1024 * 1024 * 8) / duration - 128000) * 0.85)
    )
  );
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
    "23",
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
