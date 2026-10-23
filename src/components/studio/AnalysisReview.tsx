import { useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Lightbulb,
  Maximize2,
  Pause,
  Play,
  ScanLine,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Asset } from "@contracts/workspace";
import {
  buildStorySections,
  STORY_ROLE_LABELS,
  responseForInterval,
  type AudienceResponse,
} from "@contracts/analyzer-report";
import {
  VIDEO_ANALYSIS_SCHEMA_VERSION,
  normalizeVideoInsights,
  scoreVideoInsights,
  type VideoInsight,
  type VideoRole,
} from "@contracts/video-analysis";
import { mediaTime } from "@/components/ui/audio-player";
import { CompactSelect } from "@/components/ui/compact-select";
import "./AnalysisReview.css";

const channels = [
  {
    id: "attention",
    label: "Attention",
    color: "#59c7ff",
    description: "Reason to keep watching",
  },
  {
    id: "stimulation",
    label: "Stimulation",
    color: "#b09aff",
    description: "Movement, edits and sound",
  },
  {
    id: "processingLoad",
    label: "Processing load",
    color: "#86c5da",
    description: "Competing information",
  },
  {
    id: "clarity",
    label: "Clarity",
    color: "#38dfb6",
    description: "Message and story coherence",
  },
] as const;
const roleLabels = STORY_ROLE_LABELS;
const roleColors: Record<VideoRole, string> = {
  hook: "#b09aff",
  core: "#59c7ff",
  proof: "#38dfb6",
  payoff: "#f4c56a",
  cta: "#ff8db2",
  other: "#93a2b8",
  unclassified: "#93a2b8",
  setup: "#86c5da",
  tension: "#ff8db2",
  development: "#59c7ff",
  demonstration: "#38dfb6",
  transition: "#93a2b8",
  resolution: "#f4c56a",
  loop: "#b09aff",
};
type Channel = (typeof channels)[number]["id"];
type Result = {
  hook?: { score: number | null; note: string };
  pacing?: { score: number | null; note: string };
  schemaVersion?: string;
  insights?: VideoInsight[];
  retention?: { start: number; end: number; score: number; note: string }[];
  coverage?: { input: string; proxyFramesPerSecond: number | null };
  structure?: {
    role: "hook" | "core" | "proof" | "payoff" | "cta";
    status: "present" | "absent" | "uncertain";
    note: string;
  }[];
};
const scoreText = (score: number | null | undefined) =>
  score == null ? "—" : Math.round(score);
const channelStyle = (color: string): CSSProperties =>
  ({ "--signal": color }) as CSSProperties;
const clamp = (value: number, end: number) => Math.max(0, Math.min(value, end));

/** A step joins consecutive observed intervals. Coverage gaps are never
 * interpolated into invented scores or decorative fluctuations. */
function signalPath(
  intervals: VideoInsight[],
  channel: Channel,
  duration: number
) {
  let path = "";
  let prior: VideoInsight | undefined;
  for (const row of intervals) {
    const score = row[channel];
    if (score === null) {
      prior = undefined;
      continue;
    }
    const x = (row.start / duration) * 1000;
    const end = (row.end / duration) * 1000;
    const y = 206 - score * 1.76;
    path += `${prior && Math.abs(prior.end - row.start) < 0.02 ? " L" : " M"} ${x.toFixed(2)} ${y.toFixed(2)} L ${end.toFixed(2)} ${y.toFixed(2)}`;
    prior = row;
  }
  return path;
}

/** Versioned observations back every displayed signal. Original video is the
 * only playback source; editorial proposals never masquerade as footage. */
export function AnalysisReview({
  asset,
  result,
  audience,
}: {
  asset: Asset;
  result: Result;
  audience?: AudienceResponse;
}) {
  const { t: ui } = useTranslation("ui");
  const roleName = (role: VideoRole) =>
    ui(roleLabels[role], { context: "story" });
  const chartId = useId().replace(/:/g, "");
  const video = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(asset.duration || 0);
  const [portrait, setPortrait] = useState(
    Boolean(asset.height && asset.width && asset.height > asset.width)
  );
  const [floor, setFloor] = useState(40);
  const [mode, setMode] = useState<"evidence" | "improvements">("improvements");
  const [showAll, setShowAll] = useState(false);
  const [visible, setVisible] = useState<Channel[]>(
    channels.map(channel => channel.id)
  );
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const versioned = result.schemaVersion === VIDEO_ANALYSIS_SCHEMA_VERSION;
  // Legacy retention notes do not establish multi-signal or story evidence.
  const intervals = useMemo(
    () => (versioned ? normalizeVideoInsights(result.insights, duration) : []),
    [versioned, result.insights, duration]
  );
  const aggregate = useMemo(
    () => scoreVideoInsights(intervals, duration),
    [intervals, duration]
  );
  const complete = versioned && aggregate.status === "complete";
  const sections = useMemo(
    () => buildStorySections(intervals, duration),
    [intervals, duration]
  );
  const response =
    audience?.assetId === asset.id &&
    Math.abs(audience.duration - duration) <= 0.25
      ? audience
      : undefined;
  const responseMaximum = Math.max(
    100,
    ...(response?.points.map(point => point.retention) || [])
  );
  const selectedIndex = intervals.findIndex(
    row => row.start <= time && time < row.end
  );
  const currentIndex =
    selectedIndex === -1 && time === duration
      ? intervals.length - 1
      : selectedIndex;
  const current = intervals[currentIndex];
  const previous = currentIndex > 0 ? intervals[currentIndex - 1] : undefined;
  const hovered =
    hoverTime === null
      ? undefined
      : intervals.find(row => row.start <= hoverTime && hoverTime < row.end);
  const risks = intervals.filter(
    row => row.attention !== null && row.attention < floor
  );
  const structure = versioned ? result.structure || [] : [];
  const percent = duration > 0 ? (clamp(time, duration) / duration) * 100 : 0;
  const confidence = current?.confidence;
  const seek = (next: number) => {
    const position = clamp(next, duration);
    pendingSeek.current = position;
    if (video.current && video.current.readyState >= 1)
      video.current.currentTime = position;
    setTime(position);
  };
  const toggle = () => {
    const player = video.current;
    if (!player) return;
    if (!player.paused) player.pause();
    else
      void player
        .play()
        .catch(() =>
          setPlaybackError(
            ui("Playback could not start. Reload the source and try again.")
          )
        );
  };
  const shownMoments = showAll ? intervals : current ? [current] : [];

  return (
    <section
      className="analysis-review"
      aria-label={ui("Your video, moment by moment")}
    >
      <header className="ar-heading">
        <div>
          <p className="ar-eyebrow">
            <ScanLine aria-hidden="true" />
            {ui("Short-form intelligence")}
          </p>
          <h2>{ui("Your video, moment by moment")}</h2>
        </div>
        <span
          className={`ar-report-status ${complete ? "is-complete" : "is-incomplete"}`}
        >
          {complete ? (
            <Check aria-hidden="true" />
          ) : (
            <Activity aria-hidden="true" />
          )}
          {ui(complete ? "Evidence complete" : "Incomplete report")}
        </span>
      </header>
      <div
        className={`ar-theater ${portrait ? "is-portrait" : "is-landscape"}`}
      >
        <div className="ar-source">
          <div className="ar-screen">
            <video
              ref={video}
              src={asset.url}
              playsInline
              preload="metadata"
              aria-label={asset.name}
              onTimeUpdate={event => {
                const position = event.currentTarget.currentTime;
                // A pre-metadata seek can receive the initial 0s event before
                // the requested frame. Do not move the selected report back.
                if (
                  pendingSeek.current !== null &&
                  Math.abs(position - pendingSeek.current) > 0.1
                )
                  return;
                pendingSeek.current = null;
                setTime(position);
              }}
              onSeeked={event => {
                if (
                  pendingSeek.current !== null &&
                  Math.abs(
                    event.currentTarget.currentTime - pendingSeek.current
                  ) <= 0.1
                ) {
                  pendingSeek.current = null;
                  setTime(event.currentTarget.currentTime);
                }
              }}
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
                if (pendingSeek.current !== null)
                  event.currentTarget.currentTime = clamp(
                    pendingSeek.current,
                    event.currentTarget.duration || asset.duration || 0
                  );
              }}
              onError={() =>
                setPlaybackError(
                  ui(
                    "The source preview could not load. Refresh the Library link."
                  )
                )
              }
            />
            <span className="ar-source-badge">
              <span />
              {ui("Original source")}
            </span>
            {current ? (
              <button
                type="button"
                onClick={() => seek(current.start)}
                className="ar-moment-overlay"
                style={channelStyle(roleColors[current.role])}
              >
                <span className="ar-role-dot" />
                <span>
                  <strong>{roleName(current.role)}</strong>
                  <span>{current.label}</span>
                </span>
                <span className="ar-overlay-time">
                  {mediaTime(current.start)}
                </span>
              </button>
            ) : null}
          </div>
          <div className="ar-transport">
            <button
              type="button"
              className="ar-play"
              onClick={toggle}
              aria-label={ui(playing ? "Pause video" : "Play video")}
            >
              {playing ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </button>
            <span className="ar-clock">
              <strong>{mediaTime(time)}</strong>
              <span>/ {mediaTime(duration)}</span>
            </span>
            <input
              type="range"
              className="media-seek ar-seek"
              aria-label={ui("Playback position")}
              min={0}
              max={duration || 1}
              step={0.05}
              value={Math.min(time, duration || 1)}
              onChange={event => seek(Number(event.target.value))}
              style={{
                background: `linear-gradient(to right,#b09aff ${percent}%,#ffffff24 ${percent}%)`,
              }}
            />
            <button
              type="button"
              className="ar-icon-button"
              aria-label={ui(muted ? "Unmute video" : "Mute video")}
              onClick={() => {
                if (video.current) video.current.muted = !muted;
                setMuted(!muted);
              }}
            >
              {muted ? (
                <VolumeX aria-hidden="true" />
              ) : (
                <Volume2 aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="ar-icon-button"
              aria-label={ui("Fullscreen video")}
              onClick={() =>
                void video.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setPlaybackError(
                      ui("Fullscreen is unavailable in this browser.")
                    )
                  )
              }
            >
              <Maximize2 aria-hidden="true" />
            </button>
          </div>
          {playbackError ? (
            <p className="ar-playback-error" role="alert">
              {playbackError}
            </p>
          ) : null}
        </div>
        <aside className="ar-intelligence">
          <div className="ar-overall">
            <div
              className={`ar-score-orbit ${complete ? "is-scored" : ""}`}
              style={
                { "--score": complete ? aggregate.score : 0 } as CSSProperties
              }
            >
              <div>
                <strong>{complete ? scoreText(aggregate.score) : "—"}</strong>
                <span>/ 100</span>
              </div>
            </div>
            <div className="ar-overall-copy">
              <p className="ar-eyebrow">{ui("Overall score")}</p>
              <h3>
                {ui(complete ? "Editorial score" : "Overall score unavailable")}
              </h3>
              <p>
                {ui(
                  complete
                    ? "Average across the video"
                    : "Full coverage and all four signals are required."
                )}
              </p>
            </div>
          </div>
          <div className="ar-response-heading">
            <p className="ar-eyebrow">
              {ui("Editorial signals at {{time}}", { time: mediaTime(time) })}
            </p>
            <div className="ar-moment-navigation">
              <button
                type="button"
                aria-label={ui("Previous moment")}
                disabled={currentIndex <= 0}
                onClick={() => seek(intervals[currentIndex - 1].start)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={ui("Next moment")}
                disabled={
                  !intervals.length || currentIndex >= intervals.length - 1
                }
                onClick={() =>
                  seek(intervals[Math.max(0, currentIndex + 1)].start)
                }
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="ar-signal-grid">
            {channels.map(channel => {
              const score = current?.[channel.id];
              const prior = previous?.[channel.id];
              const delta =
                score != null && prior != null ? score - prior : null;
              return (
                <div
                  className={`ar-signal-card ${score == null ? "is-unavailable" : ""}`}
                  key={channel.id}
                  style={channelStyle(channel.color)}
                >
                  <div className="ar-signal-top">
                    <span className="ar-signal-dot" />
                    <span>{ui(channel.label)}</span>
                  </div>
                  <div className="ar-signal-value">
                    <strong>{scoreText(score)}</strong>
                    <span>{score == null ? ui("Unavailable") : "/ 100"}</span>
                  </div>
                  <div className="ar-signal-track">
                    <span style={{ width: `${score ?? 0}%` }} />
                  </div>
                  <div className="ar-signal-bottom">
                    <span>{ui(channel.description)}</span>
                    {delta !== null && delta !== 0 ? (
                      <span
                        className="ar-delta"
                        title={ui("vs previous moment")}
                      >
                        {delta > 0 ? (
                          <ArrowUpRight aria-hidden="true" />
                        ) : (
                          <ArrowDownRight aria-hidden="true" />
                        )}
                        {delta > 0 ? "+" : ""}
                        {Math.round(delta)}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="ar-evidence-stats">
            <div>
              <span>{ui("Source coverage")}</span>
              <strong>
                {versioned ? `${Math.round(aggregate.coveragePercent)}%` : "—"}
              </strong>
            </div>
            <div>
              <span>{ui("Evidence confidence")}</span>
              <strong>
                {confidence == null ? "—" : `${Math.round(confidence * 100)}%`}
              </strong>
            </div>
          </div>
          {!complete ? (
            <p className="ar-incomplete-note">
              {ui(
                "Analysis data is incomplete. Run a new full-video analysis to populate all signals and story sections."
              )}
            </p>
          ) : null}
        </aside>
      </div>
      <div className="ar-scorecard-panel">
        <div className="ar-section-heading">
          <div>
            <p className="ar-eyebrow">{ui("Editorial estimates")}</p>
            <h3>{ui("The whole picture")}</h3>
          </div>
          <span className="ar-small-label">
            {ui("No measured audience response implied")}
          </span>
        </div>
        <div className="ar-scorecards">
          {[
            {
              label: "Hook",
              score: result.hook?.score,
              note: result.hook?.note,
            },
            {
              label: "Pacing",
              score: result.pacing?.score,
              note: result.pacing?.note,
            },
            {
              label: "Attention",
              score: aggregate.attention,
              note: "Reason to keep watching",
            },
            {
              label: "Clarity",
              score: aggregate.clarity,
              note: "Message and story coherence",
            },
            {
              label: "Processing load",
              score: aggregate.processingLoad,
              note: "Competing information",
            },
            {
              label: "Stimulation",
              score: aggregate.stimulation,
              note: "Movement, edits and sound",
            },
          ].map(metric => (
            <article key={metric.label}>
              <span>{ui(metric.label)}</span>
              <strong>
                {scoreText(metric.score)}
                <small>/100</small>
              </strong>
              <p>
                {metric.label === "Hook" || metric.label === "Pacing"
                  ? metric.note || ui("Unavailable")
                  : ui(metric.note!)}
              </p>
            </article>
          ))}
        </div>
      </div>
      <div className="ar-timeline-panel">
        <div className="ar-section-heading">
          <div>
            <p className="ar-eyebrow">{ui("Source time")}</p>
            <h3>{ui("Signal timeline")}</h3>
          </div>
          <span className="ar-small-label">
            {ui("{{count}} observed moments", { count: intervals.length })}
          </span>
        </div>
        <div className="ar-chart-toolbar">
          <div className="ar-chart-legend">
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
                className={visible.includes(channel.id) ? "is-visible" : ""}
                style={channelStyle(channel.color)}
              >
                <span />
                <span>{ui(channel.label)}</span>
                <strong>{scoreText(current?.[channel.id])}</strong>
              </button>
            ))}
          </div>
          <div className="ar-threshold">
            <span>{ui("Review below")}</span>
            <CompactSelect
              aria-label={ui("Review below")}
              value={String(floor)}
              onValueChange={value => setFloor(Number(value))}
              options={[25, 40, 50, 60].map(value => ({
                value: String(value),
                label: String(value),
              }))}
            />
          </div>
        </div>
        {intervals.length && duration > 0 ? (
          <>
            <div className="ar-chart" onPointerLeave={() => setHoverTime(null)}>
              <svg
                viewBox="0 0 1000 240"
                preserveAspectRatio="none"
                role="img"
                aria-label={ui("Editorial signals by source time")}
                onPointerMove={event => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setHoverTime(
                    clamp(
                      ((event.clientX - bounds.left) / bounds.width) * duration,
                      duration
                    )
                  );
                }}
                onClick={event => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  seek(
                    ((event.clientX - bounds.left) / bounds.width) * duration
                  );
                }}
              >
                <defs>
                  <linearGradient
                    id={`ar-attention-${chartId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#59c7ff" stopOpacity="0.14" />
                    <stop
                      offset="100%"
                      stopColor="#59c7ff"
                      stopOpacity="0.01"
                    />
                  </linearGradient>
                </defs>
                {[0, 25, 50, 75, 100].map(score => (
                  <g key={score}>
                    <line
                      x1={0}
                      x2={1000}
                      y1={206 - score * 1.76}
                      y2={206 - score * 1.76}
                      stroke="currentColor"
                      opacity={0.08}
                    />
                    <text
                      x={4}
                      y={201 - score * 1.76}
                      className="ar-chart-scale"
                    >
                      {score}
                    </text>
                  </g>
                ))}
                {risks.map(row => (
                  <g key={`${row.start}-${row.end}`}>
                    <rect
                      x={(row.start / duration) * 1000}
                      y={20}
                      width={((row.end - row.start) / duration) * 1000}
                      height={188}
                      rx={8}
                      fill="#ff6689"
                      opacity={0.12}
                    />
                    <path
                      d={`M ${(row.start / duration) * 1000 + 5} 13 l 5 5 l -5 5 l -5 -5 Z`}
                      fill="#ff6689"
                    />
                  </g>
                ))}
                <line
                  x1={0}
                  x2={1000}
                  y1={206 - floor * 1.76}
                  y2={206 - floor * 1.76}
                  stroke="#ff6689"
                  opacity={0.44}
                  strokeDasharray="4 6"
                />
                {visible.includes("attention")
                  ? intervals
                      .filter(row => row.attention !== null)
                      .map(row => (
                        <path
                          key={row.start}
                          d={`M ${(row.start / duration) * 1000} 206 V ${206 - row.attention! * 1.76} H ${(row.end / duration) * 1000} V 206 Z`}
                          fill={`url(#ar-attention-${chartId})`}
                        />
                      ))
                  : null}
                {channels
                  .filter(channel => visible.includes(channel.id))
                  .map(channel => (
                    <path
                      key={channel.id}
                      d={signalPath(intervals, channel.id, duration)}
                      fill="none"
                      stroke={channel.color}
                      strokeWidth={channel.id === "attention" ? 2.7 : 1.8}
                      opacity={channel.id === "attention" ? 1 : 0.85}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                <line
                  x1={percent * 10}
                  x2={percent * 10}
                  y1={12}
                  y2={220}
                  stroke="#ffffff"
                  opacity={0.85}
                  vectorEffect="non-scaling-stroke"
                />
                {current
                  ? channels
                      .filter(
                        channel =>
                          visible.includes(channel.id) &&
                          current[channel.id] !== null
                      )
                      .map(channel => (
                        <circle
                          key={channel.id}
                          cx={percent * 10}
                          cy={206 - current[channel.id]! * 1.76}
                          r={3.5}
                          fill={channel.color}
                          stroke="#101016"
                          strokeWidth={1.5}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))
                  : null}
                {hoverTime !== null ? (
                  <line
                    x1={(hoverTime / duration) * 1000}
                    x2={(hoverTime / duration) * 1000}
                    y1={12}
                    y2={220}
                    stroke="#ffffff"
                    opacity={0.25}
                    strokeDasharray="2 4"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>
              {hovered && hoverTime !== null ? (
                <div
                  className="ar-chart-tooltip"
                  style={{
                    left: `${clamp((hoverTime / duration) * 100, 78)}%`,
                  }}
                >
                  <span>
                    {mediaTime(hoverTime)} · {roleName(hovered.role)}
                  </span>
                  {channels.map(channel => (
                    <div key={channel.id} style={channelStyle(channel.color)}>
                      <span>{ui(channel.label)}</span>
                      <strong>{scoreText(hovered[channel.id])}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="ar-time-axis">
              {[0, 0.25, 0.5, 0.75, 1].map(fraction => (
                <button
                  key={fraction}
                  type="button"
                  aria-label={ui("Seek to {{time}}", {
                    time: mediaTime(duration * fraction),
                  })}
                  onClick={() => seek(duration * fraction)}
                >
                  {mediaTime(duration * fraction)}
                </button>
              ))}
            </div>
            <div className="ar-role-lane" aria-label={ui("Story structure")}>
              {intervals.map(row => (
                <button
                  key={`${row.start}-${row.end}`}
                  type="button"
                  aria-label={ui("Select {{section}} section", {
                    section: `${roleName(row.role)} ${mediaTime(row.start)}`,
                  })}
                  title={`${roleName(row.role)} · ${mediaTime(row.start)}–${mediaTime(row.end)} · ${row.label}`}
                  onClick={() => seek(row.start)}
                  className={current === row ? "is-current" : ""}
                  style={{
                    ...channelStyle(roleColors[row.role]),
                    left: `${(row.start / duration) * 100}%`,
                    width: `${((row.end - row.start) / duration) * 100}%`,
                  }}
                >
                  <span>{roleName(row.role)}</span>
                </button>
              ))}
            </div>
            <input
              type="range"
              className="sr-only"
              aria-label={ui("Analysis playback position")}
              min={0}
              max={duration}
              step={0.05}
              value={clamp(time, duration)}
              onChange={event => seek(Number(event.target.value))}
            />
          </>
        ) : (
          <div className="ar-empty-chart">
            <Activity aria-hidden="true" />
            <p>
              {ui("No complete signal timeline is available for this report.")}
            </p>
          </div>
        )}
        <div className="ar-risk-list">
          <span>
            <span className="ar-risk-diamond" />
            {ui("Review moments")} <strong>{risks.length}</strong>
          </span>
          {risks.map(row => (
            <button
              key={row.start}
              type="button"
              onClick={() => seek(row.start)}
            >
              <span className="ar-risk-diamond" />
              {mediaTime(row.start)}
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
          {intervals.length > 0 && !risks.length ? (
            <small>{ui("No low-attention intervals at this threshold.")}</small>
          ) : null}
        </div>
        {response ? (
          <div className="ar-audience-chart">
            <svg
              viewBox="0 0 1000 120"
              preserveAspectRatio="none"
              role="img"
              aria-label={ui("Imported audience retention")}
              onClick={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                seek(((event.clientX - bounds.left) / bounds.width) * duration);
              }}
            >
              {[0, responseMaximum / 2, responseMaximum].map(value => (
                <g key={value}>
                  <line
                    x1={0}
                    x2={1000}
                    y1={100 - (value / responseMaximum) * 80}
                    y2={100 - (value / responseMaximum) * 80}
                    stroke="currentColor"
                    opacity={0.1}
                  />
                  <text
                    x={4}
                    y={96 - (value / responseMaximum) * 80}
                    className="ar-chart-scale"
                  >{`${Math.round(value)}%`}</text>
                </g>
              ))}
              {response
                ? response.points.map((point, index, all) => {
                    const next = all[index + 1];
                    // Separate from editorial curves; actual samples only, and
                    // a dynamic scale preserves replay values above 100%.
                    const maximum = responseMaximum;
                    return (
                      <g key={point.time}>
                        <circle
                          cx={(point.time / duration) * 1000}
                          cy={100 - (point.retention / maximum) * 80}
                          r={3}
                          fill="#f4c56a"
                        >
                          <title>{`${mediaTime(point.time)}: ${point.retention}%`}</title>
                        </circle>
                        {next ? (
                          <line
                            x1={(point.time / duration) * 1000}
                            x2={(next.time / duration) * 1000}
                            y1={100 - (point.retention / maximum) * 80}
                            y2={100 - (next.retention / maximum) * 80}
                            stroke="#f4c56a"
                            strokeDasharray="3 5"
                            opacity={0.55}
                          />
                        ) : null}
                      </g>
                    );
                  })
                : null}

              <line
                x1={percent * 10}
                x2={percent * 10}
                y1={10}
                y2={110}
                stroke="#fff"
                opacity={0.6}
              />
            </svg>
          </div>
        ) : null}
        {response ? (
          <p className="ar-measurement-note">
            {ui("Imported audience retention")} · {response.source} ·{" "}
            {response.period} · {response.sampleSize.toLocaleString()}{" "}
            {ui("views")} ·{" "}
            {ui(
              "Gold: imported retention, 0–{{maximum}}%. Connectors are visual guides.",
              { maximum: responseMaximum }
            )}
          </p>
        ) : null}
      </div>
      {sections.length ? (
        <div className="ar-section-panel">
          <div className="ar-section-heading">
            <div>
              <p className="ar-eyebrow">{ui("Story structure")}</p>
              <h3>{ui("Every section has a job")}</h3>
            </div>
            <span className="ar-small-label">
              {ui("Sections follow observed purpose")}
            </span>
          </div>
          <div className="ar-section-cards">
            {sections.map(section => (
              <button
                key={section.start}
                type="button"
                onClick={() => seek(section.start)}
                className={
                  time >= section.start && time < section.end
                    ? "is-selected"
                    : ""
                }
                style={channelStyle(roleColors[section.role])}
              >
                <span className="ar-role-dot" />
                <strong>{roleName(section.role)}</strong>
                <span>
                  {mediaTime(section.start)}–{mediaTime(section.end)}
                </span>
                <b>
                  {scoreText(section.rating.score)}
                  <small>/100</small>
                </b>
                <p>
                  {section.moments[0].roleReason || section.moments[0].label}
                </p>
                <span className="ar-small-label">
                  {ui("Attention")} {scoreText(section.rating.attention)} ·{" "}
                  {ui("Clarity")} {scoreText(section.rating.clarity)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {structure.length ? (
        <div className="ar-structure-summary">
          <span className="ar-small-label">{ui("Story structure")}</span>
          <div>
            {structure.map(section => {
              const first = intervals.find(row => row.role === section.role);
              return (
                <button
                  type="button"
                  key={section.role}
                  disabled={!first}
                  onClick={() => first && seek(first.start)}
                  title={section.note}
                  style={channelStyle(roleColors[section.role])}
                  className={`is-${section.status}`}
                >
                  <span className="ar-role-dot" />
                  <strong>{roleName(section.role)}</strong>
                  <span>
                    {ui(
                      section.status === "present"
                        ? "Present"
                        : section.status === "absent"
                          ? "Absent"
                          : "Uncertain"
                    )}
                  </span>
                  {first ? <ChevronRight aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="ar-moment-panel">
        <div className="ar-section-heading">
          <div>
            <p className="ar-eyebrow">{ui("Current moment")}</p>
            <h3>{current?.label || ui("No evidence covers this moment.")}</h3>
          </div>
          <div className="ar-view-tabs">
            {(["evidence", "improvements"] as const).map(value => (
              <button
                type="button"
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={mode === value ? "is-active" : ""}
              >
                {value === "evidence" ? (
                  <Eye aria-hidden="true" />
                ) : (
                  <Lightbulb aria-hidden="true" />
                )}
                {ui(value === "evidence" ? "Evidence" : "Improvements")}
              </button>
            ))}
          </div>
        </div>
        {intervals.length > 1 ? (
          <button
            type="button"
            className="ar-all-moments"
            aria-expanded={showAll}
            onClick={() => setShowAll(value => !value)}
          >
            {ui(showAll ? "Show selected moment" : "Show all moments")}
            <ChevronRight aria-hidden="true" />
          </button>
        ) : null}
        {shownMoments.length ? (
          <div className="ar-observations">
            {shownMoments.map(row => (
              <article
                key={row.start}
                className={`ar-observation ${current === row ? "is-selected" : ""}`}
              >
                <div className="ar-observation-heading">
                  <button
                    type="button"
                    onClick={() => seek(row.start)}
                    style={channelStyle(roleColors[row.role])}
                  >
                    <span className="ar-role-dot" />
                    <strong>{roleName(row.role)}</strong>
                    <span>
                      {mediaTime(row.start)}–{mediaTime(row.end)}
                    </span>
                    <Play aria-hidden="true" />
                  </button>
                  <span>
                    {row.confidence == null
                      ? ui("Unavailable")
                      : `${Math.round(row.confidence * 100)}%`}{" "}
                    · {ui("Confidence")}
                  </span>
                </div>
                <div className="ar-evidence-grid">
                  {(() => {
                    const measurement = responseForInterval(
                      response,
                      asset.id,
                      row.start,
                      row.end
                    );
                    return measurement ? (
                      <div className="ar-measured-moment">
                        <strong>{ui("Imported audience retention")}</strong>
                        <p>
                          {measurement.first.toFixed(1)}%
                          {measurement.points.length > 1
                            ? ` → ${measurement.last.toFixed(1)}%`
                            : ""}
                          {measurement.delta !== null
                            ? ` (${measurement.delta >= 0 ? "+" : ""}${measurement.delta.toFixed(1)} pp)`
                            : ""}
                        </p>
                        <small>
                          {ui(
                            "Observed association; the explanation is a hypothesis."
                          )}
                        </small>
                      </div>
                    ) : null;
                  })()}
                  {mode === "evidence" ? (
                    <>
                      <Evidence
                        label={ui("Visual evidence")}
                        text={row.visualEvidence}
                        empty={ui("No supported observation was returned.")}
                        kind="visual"
                      />
                      <Evidence
                        label={ui("Audio evidence")}
                        text={row.audioEvidence}
                        empty={ui("No supported observation was returned.")}
                        kind="audio"
                      />
                    </>
                  ) : (
                    <>
                      <Evidence
                        label={ui("What works")}
                        text={row.strength}
                        empty={ui("No supported observation was returned.")}
                        kind="strength"
                      />
                      <Evidence
                        label={ui("Improve next")}
                        text={row.improvement}
                        empty={ui("No supported observation was returned.")}
                        kind="improvement"
                      />
                    </>
                  )}
                  {row.rationale ? (
                    <div className="ar-rationale">
                      <span>{ui("Why it matters")}</span>
                      <p>{row.rationale}</p>
                    </div>
                  ) : null}
                  {mode === "evidence" && row.roleReason ? (
                    <div className="ar-role-evidence">
                      <span>{ui("Section evidence")}</span>
                      <p>{row.roleReason}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="ar-missing-evidence">
            {ui(
              "Analysis data is incomplete. Run a new full-video analysis to populate all signals and story sections."
            )}
          </p>
        )}
      </div>
      <details className="ar-methodology">
        <summary>
          {ui("How this score is calculated")}
          <ChevronRight aria-hidden="true" />
        </summary>
        <div>
          <p>
            {ui(
              "Scores follow a fixed editorial rubric. They are not measured audience or neural responses."
            )}
          </p>
          <p>
            {ui(
              "Overall = 45% attention + 35% clarity + 20% processing ease. Processing ease = 100 − processing load. Stimulation describes intensity and is not rewarded automatically."
            )}
          </p>
          <p>
            {ui(
              result.coverage?.input === "full-duration-proxy"
                ? "Full-duration video copy · {{fps}} fps"
                : "Complete source video and available audio",
              { fps: result.coverage?.proxyFramesPerSecond ?? 8 }
            )}
            . {ui("The provider controls internal frame sampling.")}
          </p>
          <p>
            {ui("Research context")}:{" "}
            <a
              href="https://doi.org/10.1111/j.1460-2466.2000.tb02833.x"
              target="_blank"
              rel="noreferrer"
            >
              {ui("Limited-capacity model of message processing")}
            </a>
            .{" "}
            {ui(
              "This rubric has not been calibrated as an audience or neural predictor."
            )}
          </p>
        </div>
      </details>
    </section>
  );
}

function Evidence({
  label,
  text,
  empty,
  kind,
}: {
  label: string;
  text: string;
  empty: string;
  kind: "visual" | "audio" | "strength" | "improvement";
}) {
  return (
    <div className={`ar-evidence-card is-${kind}`}>
      <div>
        <span>
          {kind === "strength" ? (
            <Check aria-hidden="true" />
          ) : kind === "improvement" ? (
            <Lightbulb aria-hidden="true" />
          ) : kind === "visual" ? (
            <Film aria-hidden="true" />
          ) : (
            <Volume2 aria-hidden="true" />
          )}
        </span>
        <h4>{label}</h4>
      </div>
      <p>{text || empty}</p>
    </div>
  );
}
