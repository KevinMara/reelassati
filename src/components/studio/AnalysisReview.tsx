import { useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Eye,
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Asset } from "@contracts/workspace";
import type { VideoInsight } from "@contracts/video-analysis";
import { mediaTime } from "@/components/ui/audio-player";
import { CompactSelect } from "@/components/ui/compact-select";

const channels = [
  {
    id: "attention",
    label: "Attention",
    color: "#53b9f5",
    description: "Reason to keep watching",
  },
  {
    id: "stimulation",
    label: "Stimulation",
    color: "#ad94f5",
    description: "Movement, edits and sound",
  },
  {
    id: "processingLoad",
    label: "Processing load",
    color: "#86bac8",
    description: "Competing information",
  },
  {
    id: "clarity",
    label: "Clarity",
    color: "#35cfad",
    description: "Message and story coherence",
  },
] as const;
const roles = {
  hook: "Hook",
  core: "Core",
  proof: "Proof",
  payoff: "Payoff",
  cta: "CTA",
  other: "Other",
};
type Result = {
  insights?: VideoInsight[];
  retention: { start: number; end: number; score: number; note: string }[];
  coverage?: { input: string; proxyFramesPerSecond: number | null };
};

/** Every score and marker is sourced from an evidenced model interval. Playback
 * is the original file; suggested edits are never shown as rendered footage. */
export function AnalysisReview({
  asset,
  result,
}: {
  asset: Asset;
  result: Result;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(asset.duration || 0);
  const [portrait, setPortrait] = useState(
    Boolean(asset.height && asset.width && asset.height > asset.width)
  );
  const [floor, setFloor] = useState(40);
  const [mode, setMode] = useState<"evidence" | "improvements">("evidence");
  const [visible, setVisible] = useState<string[]>(channels.map(c => c.id));
  const [playbackError, setPlaybackError] = useState("");
  const intervals = useMemo<VideoInsight[]>(
    () =>
      result.insights?.length
        ? result.insights
        : result.retention.map(row => ({
            start: row.start,
            end: row.end,
            attention: row.score,
            label: "Source observation",
            role: "other",
            stimulation: null,
            processingLoad: null,
            clarity: null,
            confidence: null,
            visualEvidence: row.note,
            audioEvidence: "",
            strength: "",
            improvement: "",
            rationale: "",
          })),
    [result]
  );
  const current =
    intervals.find(row => row.start <= time && time < row.end) ??
    (time === duration ? intervals.at(-1) : undefined);
  const previous = current
    ? intervals[intervals.indexOf(current) - 1]
    : undefined;
  const risks = intervals.filter(
    row => row.attention !== null && row.attention < floor
  );
  const seek = (next: number) => {
    if (video.current) video.current.currentTime = next;
    setTime(next);
  };
  const toggle = () => {
    const player = video.current;
    if (!player) return;
    if (playing) player.pause();
    else
      void player
        .play()
        .catch(() =>
          setPlaybackError(
            "Playback could not start. Reload the source and try again."
          )
        );
  };
  const percent = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-surface"
      aria-label="Synchronized video evidence review"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="mono-eyebrow text-primary">Short-form intelligence</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            See where your story holds attention
          </h2>
        </div>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          Full-duration video · available audio
        </span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 border-b border-border bg-black lg:border-b-0 lg:border-r">
          <div className="relative flex min-h-48 items-center justify-center">
            <video
              ref={video}
              src={asset.url}
              playsInline
              preload="metadata"
              className={
                portrait
                  ? "h-[65vh] max-h-[42rem] w-auto max-w-full object-contain"
                  : "aspect-video max-h-[65vh] w-full object-contain"
              }
              aria-label={`Analyzed source: ${asset.name}`}
              onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onLoadedMetadata={event => {
                setPortrait(
                  event.currentTarget.videoHeight >
                    event.currentTarget.videoWidth
                );
                setDuration(
                  Number.isFinite(event.currentTarget.duration)
                    ? event.currentTarget.duration
                    : asset.duration || 0
                );
              }}
              onError={() =>
                setPlaybackError(
                  "The source preview could not load. Reload its Library link to refresh access."
                )
              }
            />
            <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Original source
            </span>
            {current && (
              <button
                type="button"
                onClick={() => seek(current.start)}
                className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-left text-xs text-white backdrop-blur"
              >
                {roles[current.role]}{" "}
                <span className="ml-2 text-white/65">{current.label}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3 text-white">
            <button
              type="button"
              onClick={toggle}
              aria-label={
                playing ? "Pause analysis video" : "Play analysis video"
              }
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
            >
              {playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </button>
            <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-white/65">
              {mediaTime(time)} / {mediaTime(duration)}
            </span>
            <input
              type="range"
              aria-label="Analysis playback position"
              min={0}
              max={duration || 1}
              step={0.05}
              value={Math.min(time, duration || 1)}
              onChange={event => seek(Number(event.target.value))}
              className="media-seek min-w-5 flex-1"
              style={{
                background: `linear-gradient(to right,#ad94f5 ${percent}%,#ffffff25 ${percent}%)`,
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (video.current) video.current.muted = !muted;
                setMuted(!muted);
              }}
              aria-label={muted ? "Unmute video" : "Mute video"}
              className="rounded-lg p-2 text-white/60 hover:text-white"
            >
              {muted ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
            <button
              type="button"
              aria-label="Fullscreen video"
              onClick={() =>
                void video.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setPlaybackError(
                      "Fullscreen is unavailable in this browser."
                    )
                  )
              }
              className="rounded-lg p-2 text-white/60 hover:text-white"
            >
              <Maximize2 className="size-4" />
            </button>
          </div>
          {playbackError && (
            <p className="px-4 pb-3 text-xs text-rose-300" role="alert">
              {playbackError}
            </p>
          )}
        </div>
        <aside className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <p className="mono-eyebrow text-foreground/50">
              Response at {mediaTime(time)}
            </p>
            <Activity className="size-4 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-1 lg:gap-y-4">
            {channels.map(channel => {
              const score = current?.[channel.id];
              const prior = previous?.[channel.id];
              const delta =
                score != null && prior != null ? score - prior : null;
              return (
                <div key={channel.id}>
                  <div className="flex items-end justify-between gap-2">
                    <span
                      className="text-3xl font-light tabular-nums tracking-tight"
                      style={{ color: channel.color }}
                    >
                      {score == null ? "—" : Math.round(score)}
                    </span>
                    {delta !== null && delta !== 0 && (
                      <span className="flex items-center text-[11px] text-muted-foreground">
                        {delta > 0 ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {delta > 0 ? "+" : ""}
                        {Math.round(delta)} vs prior
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex justify-between text-xs">
                    <span>{channel.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Estimate
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-150"
                      style={{
                        width: `${score ?? 0}%`,
                        background: channel.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
            Editorial content signals, linked to the evidence below. Audience
            response is established by real viewing data.
          </p>
        </aside>
      </div>
      <div className="border-t border-border px-5 py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            {channels.map(channel => (
              <button
                key={channel.id}
                type="button"
                aria-pressed={visible.includes(channel.id)}
                onClick={() =>
                  setVisible(current =>
                    current.includes(channel.id)
                      ? current.filter(id => id !== channel.id)
                      : [...current, channel.id]
                  )
                }
                className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${visible.includes(channel.id) ? "opacity-100" : "opacity-35"}`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: channel.color }}
                />
                {channel.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Review below</span>
            <div className="w-16">
              <CompactSelect
                aria-label="Attention review threshold"
                value={String(floor)}
                onValueChange={value => setFloor(Number(value))}
                options={[25, 40, 50, 60].map(value => ({
                  value: String(value),
                  label: String(value),
                }))}
              />
            </div>
          </div>
        </div>
        {intervals.length && duration > 0 ? (
          <>
            <svg
              viewBox="0 0 1000 220"
              className="h-44 w-full cursor-crosshair sm:h-56"
              preserveAspectRatio="none"
              role="img"
              aria-label="Editorial signal scores by source time. Use the time buttons below to seek."
              onClick={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                seek(
                  Math.max(
                    0,
                    Math.min(
                      duration,
                      ((event.clientX - bounds.left) / bounds.width) * duration
                    )
                  )
                );
              }}
            >
              {[0, 25, 50, 75, 100].map(score => (
                <line
                  key={score}
                  x1={0}
                  x2={1000}
                  y1={190 - score * 1.7}
                  y2={190 - score * 1.7}
                  stroke="currentColor"
                  opacity={0.07}
                />
              ))}
              {risks.map(row => (
                <rect
                  key={`${row.start}-${row.end}`}
                  x={(row.start / duration) * 1000}
                  y={15}
                  width={((row.end - row.start) / duration) * 1000}
                  height={175}
                  rx={5}
                  fill="#f35f78"
                  opacity={0.09}
                />
              ))}
              <line
                x1={0}
                x2={1000}
                y1={190 - floor * 1.7}
                y2={190 - floor * 1.7}
                stroke="#f35f78"
                opacity={0.5}
                strokeDasharray="4 5"
              />
              {channels
                .filter(c => visible.includes(c.id))
                .map(channel => (
                  <path
                    key={channel.id}
                    d={intervals
                      .flatMap(row =>
                        row[channel.id] === null
                          ? []
                          : [
                              `M ${(row.start / duration) * 1000} ${190 - row[channel.id]! * 1.7} L ${(row.end / duration) * 1000} ${190 - row[channel.id]! * 1.7}`,
                            ]
                      )
                      .join(" ")}
                    fill="none"
                    stroke={channel.color}
                    strokeWidth={2.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              <line
                x1={percent * 10}
                x2={percent * 10}
                y1={10}
                y2={200}
                stroke="currentColor"
                opacity={0.65}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
              {[0, 0.25, 0.5, 0.75, 1].map(fraction => (
                <button
                  key={fraction}
                  type="button"
                  onClick={() => seek(duration * fraction)}
                  className="rounded px-1 py-2 hover:text-primary"
                >
                  {mediaTime(duration * fraction)}
                </button>
              ))}
            </div>
            <div
              className="relative mt-3 h-8 overflow-hidden rounded-lg bg-muted/50"
              aria-label="Automatically detected story sections"
            >
              {intervals.map(row => (
                <button
                  key={`${row.start}-${row.end}`}
                  title={`${roles[row.role]} · ${mediaTime(row.start)}–${mediaTime(row.end)} · ${row.label}`}
                  type="button"
                  onClick={() => seek(row.start)}
                  className={`absolute top-0 flex h-full items-center justify-center overflow-hidden border-r border-background/70 px-1 text-[10px] font-medium transition ${current === row ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                  style={{
                    left: `${(row.start / duration) * 100}%`,
                    width: `${((row.end - row.start) / duration) * 100}%`,
                  }}
                >
                  {roles[row.role]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-lg bg-muted/40 p-5 text-sm text-muted-foreground">
            This review has no timestamped signal evidence. Run a new full-video
            analysis to populate the graph.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="mr-1 text-xs text-muted-foreground">
            {risks.length} intervals to review
          </span>
          {risks.map(row => (
            <button
              key={row.start}
              type="button"
              onClick={() => seek(row.start)}
              className="flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 font-mono text-xs"
            >
              <span className="size-1.5 rotate-45 bg-rose-400" />
              {mediaTime(row.start)}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-border p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Inside this moment</h3>
          <div className="flex rounded-lg bg-muted/60 p-1">
            {(["evidence", "improvements"] as const).map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={`rounded-md px-3 py-1.5 text-xs capitalize transition ${mode === value ? "bg-surface font-medium shadow-sm" : "text-muted-foreground"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {current ? (
          <div className="grid gap-4 md:grid-cols-2">
            {mode === "evidence" ? (
              <>
                <Evidence
                  label="Visual evidence"
                  text={current.visualEvidence}
                />
                <Evidence label="Audio evidence" text={current.audioEvidence} />
              </>
            ) : (
              <>
                <Evidence label="What works" text={current.strength} good />
                <Evidence label="Improve next" text={current.improvement} />
              </>
            )}
            {current.rationale && (
              <div className="md:col-span-2">
                <Evidence label="Why this matters" text={current.rationale} />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground md:col-span-2">
              {mediaTime(current.start)}–{mediaTime(current.end)} ·{" "}
              {roles[current.role]}
              {current.confidence !== null
                ? ` · ${Math.round(current.confidence * 100)}% evidence confidence`
                : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Seek to an observed interval to inspect its evidence. Gaps are left
            unscored.
          </p>
        )}
        <details className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground/70">
            How to read this review
          </summary>
          <div className="mt-3 space-y-2 leading-relaxed">
            <p>
              Scores are model estimates from the supplied temporal video and
              available audio. Lines span observed intervals; missing channels
              and gaps stay empty. The review threshold is an editorial filter.
              Delta compares adjacent source intervals, rather than predicting
              the effect of an unrendered edit.
            </p>
            <p>
              {result.coverage?.input === "full-duration-proxy"
                ? `The complete duration and audio were supplied in a reduced-resolution ${result.coverage.proxyFramesPerSecond ?? 8} fps video copy.`
                : "The complete source file was supplied to the multimodal reviewer."}{" "}
              The provider controls its internal frame sampling. Source playback
              above remains original footage.
            </p>
            <p>
              Research context:{" "}
              <a
                className="underline hover:text-primary"
                href="https://doi.org/10.1111/j.1460-2466.2000.tb02833.x"
                target="_blank"
                rel="noreferrer"
              >
                Lang’s limited-capacity model of message processing
              </a>{" "}
              informs the distinction between information demands and clarity.
              This editorial rubric has not been calibrated as an audience or
              neural predictor.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
function Evidence({
  label,
  text,
  good = false,
}: {
  label: string;
  text: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/50 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {good ? (
          <Check className="size-3 text-emerald-500" />
        ) : (
          <Eye className="size-3 text-primary" />
        )}
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground/75">
        {text || "No supported observation was returned for this channel."}
      </p>
    </div>
  );
}
