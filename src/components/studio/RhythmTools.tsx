import { useUiText } from "@/lib/i18n/ui";
import { useEffect, useRef, useState } from "react";
import type { Asset, EditProject } from "@contracts/workspace";
import { expandLinkedSelection } from "@contracts/clip-groups";
import { clipLaneKind } from "@/lib/timeline-lanes";
import { CompactSelect } from "@/components/ui/compact-select";
import {
  measuredAudioBeats,
  timelineBeatCuts,
  cutSelectedOnBeats,
  speechAutoZoom,
  rhythmProjectIdentity,
  type MeasuredBeat,
} from "@/lib/rhythm-editing";

export function RhythmTools({
  project,
  assets,
  selectedIds,
  onCommit,
  onSeek,
}: {
  project: EditProject;
  assets: Asset[];
  selectedIds: string[];
  onCommit: (
    label: string,
    transform: (project: EditProject) => EditProject
  ) => Promise<void>;
  onSeek: (time: number) => void;
}) {
  const ui = useUiText();
  const pictures = project.clips.filter(
    c => clipLaneKind(c) === "video" && !c.graphic && !c.transitionHandle
  );
  const sources = project.clips.filter(
    c =>
      !c.muted &&
      !c.transitionHandle &&
      assets.some(
        a =>
          a.id === c.assetId &&
          a.status === "ready" &&
          ["audio", "video", "export"].includes(a.kind)
      )
  );
  const [sourceId, setSourceId] = useState(
    sources.find(c => c.track === "audio")?.id ?? sources[0]?.id ?? ""
  );
  const [targets, setTargets] = useState(
    selectedIds.filter(id => pictures.some(c => c.id === id))
  );
  const [sensitivity, setSensitivity] = useState(1);
  const [every, setEvery] = useState(1);
  const [gap, setGap] = useState(0.4);
  const [zoom, setZoom] = useState(1.12);
  const [replacePath, setReplacePath] = useState(false);
  const [measurement, setMeasurement] = useState<{
    sourceId: string;
    identity: string;
    beats: MeasuredBeat[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    []
  );
  const source = sources.find(c => c.id === sourceId);
  const identity = rhythmProjectIdentity(project);
  const stale =
    measurement &&
    (measurement.identity !== identity || measurement.sourceId !== sourceId);
  const times =
    measurement && !stale && source
      ? timelineBeatCuts(
          measurement.beats,
          source,
          project.duration,
          every,
          gap
        )
      : [];
  const linked = expandLinkedSelection(project, targets, {
    groups: false,
    links: true,
  }).filter(id => !targets.includes(id));
  const measure = async () => {
    if (pending.current || !source) return;
    const asset = assets.find(a => a.id === source.assetId);
    if (!asset) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setMeasurement(null);
    const request = new AbortController();
    controller.current = request;
    try {
      const { timelineWaveform } = await import("@/lib/timeline-media");
      const waveform = await timelineWaveform(asset, request.signal);
      request.signal.throwIfAborted();
      setMeasurement({
        sourceId: source.id,
        identity,
        beats: measuredAudioBeats(waveform, sensitivity),
      });
    } catch (e) {
      if (!request.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Source audio could not be measured."
        );
    } finally {
      if (controller.current === request) {
        controller.current = null;
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const apply = async (kind: "cuts" | "zoom") => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onCommit(
        kind === "cuts"
          ? "Cut selected picture on measured beats"
          : "Applied measured speech zoom",
        current => {
          if (
            rhythmProjectIdentity(current) !== identity ||
            (kind === "cuts" && (!measurement || stale))
          )
            throw new Error(
              ui(
                "The timeline changed. Measure or review it again before applying."
              )
            );
          return kind === "cuts"
            ? cutSelectedOnBeats(current, targets, times, () =>
                crypto.randomUUID()
              )
            : speechAutoZoom(current, targets, zoom, replacePath);
        }
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The rhythm edit could not be saved."
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const field = "mt-1 w-full rounded-lg border border-border bg-background p-2";
  const button =
    "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40";
  return (
    <div className="space-y-5">
      <p className="text-sm text-foreground/65">
        {ui(
          "Uses existing media and measured speech. No AI credits. Apply creates one saved revision; Undo restores the previous edit."
        )}
      </p>
      <fieldset disabled={busy} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">
          {ui("Picture clips to edit")}
        </legend>
        {pictures.length ? (
          pictures.map(c => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={targets.includes(c.id)}
                disabled={!!c.locked}
                onChange={e =>
                  setTargets(t =>
                    e.target.checked
                      ? [...t, c.id]
                      : t.filter(id => id !== c.id)
                  )
                }
              />
              {c.label} · {c.start.toFixed(2)}–
              {(c.start + c.duration).toFixed(2)}s
              {c.locked ? ui(" · Locked") : ""}
            </label>
          ))
        ) : (
          <p className="text-sm">{ui("Add picture footage first.")}</p>
        )}
        {linked.length ? (
          <p className="text-xs text-foreground/65">
            {ui("Beat cuts also split linked audio:")}{" "}
            {linked
              .map(id => project.clips.find(c => c.id === id)?.label)
              .join(", ")}
            {ui(". Independent music and other layers stay in place.")}
          </p>
        ) : null}
      </fieldset>
      <section
        className="space-y-3 rounded-xl border border-border p-3"
        aria-label={ui("Beat cuts")}
      >
        <h3 className="text-sm font-semibold">{ui("Beat cuts")}</h3>
        <p className="text-xs text-foreground/65">
          {ui(
            "Measures percussive onsets from the actual waveform, up to five minutes / 16 MB. Review points before cutting. This does not infer downbeats or rearrange shots."
          )}
        </p>
        <CompactSelect
          aria-label={ui("Beat audio source")}
          value={sourceId}
          disabled={busy || !sources.length}
          options={sources.map(c => ({ value: c.id, label: c.label }))}
          onValueChange={id => {
            setSourceId(id);
            setMeasurement(null);
          }}
        />
        <label className="block text-xs">
          {ui("Sensitivity ·")} {sensitivity.toFixed(1)}
          <input
            aria-label={ui("Beat sensitivity")}
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={sensitivity}
            disabled={busy}
            className="mt-2 w-full accent-primary"
            onChange={e => {
              setSensitivity(Number(e.target.value));
              setMeasurement(null);
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy || !source}
          onClick={() => void measure()}
          className={button}
        >
          {busy ? ui("Working…") : ui("Measure source audio")}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">
            {ui("Use every Nth onset")}
            <input
              aria-label={ui("Beat interval")}
              type="number"
              min={1}
              max={8}
              step={1}
              value={every}
              disabled={busy}
              className={field}
              onChange={e => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 1 && n <= 8) setEvery(n);
              }}
            />
          </label>
          <label className="text-xs">
            {ui("Minimum gap (seconds)")}
            <input
              aria-label={ui("Minimum beat gap")}
              type="number"
              min={0.2}
              max={10}
              step={0.1}
              value={gap}
              disabled={busy}
              className={field}
              onChange={e => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0.2 && n <= 10) setGap(n);
              }}
            />
          </label>
        </div>
        {measurement ? (
          <>
            <p className="text-sm" role="status">
              {stale
                ? ui("Timeline changed. Measure again.")
                : ui("{{count}} measured cut points in this source's timeline interval.", { count: times.length })}
            </p>
            <div className="flex max-h-32 flex-wrap gap-1 overflow-auto">
              {times.slice(0, 96).map(t => (
                <button
                  key={t}
                  type="button"
                  aria-label={ui("Preview beat at {{time}} seconds", { time: t.toFixed(2) })}
                  onClick={() => onSeek(t)}
                  className="rounded border border-border px-2 py-1 text-xs tabular-nums"
                >
                  {t.toFixed(2)}s
                </button>
              ))}
            </div>
            {!stale && !times.length ? (
              <p className="text-xs text-foreground/65">
                {ui(
                  "No strong onsets were measured in the retained interval. No cut points were invented."
                )}
              </p>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          disabled={
            busy || !targets.length || !times.length || times.length > 48
          }
          onClick={() => void apply("cuts")}
          className={button}
        >
          {ui("Apply beat cuts")}
        </button>
        {times.length > 48 ? (
          <p className="text-xs">
            {ui("Use wider spacing to stay within 48 cut points.")}
          </p>
        ) : null}
      </section>
      <section
        className="space-y-3 rounded-xl border border-border p-3"
        aria-label={ui("Speech autozoom")}
      >
        <h3 className="text-sm font-semibold">{ui("Speech autozoom")}</h3>
        <p className="text-xs text-foreground/65">
          {ui(
            "Alternates restrained punch-ins at measured phrase changes. Each picture clip needs a transcript with word timing. Position stays as authored; this does not track a face or camera."
          )}
        </p>
        <label className="block text-xs">
          {ui("Zoom ·")} {zoom.toFixed(2)}×
          <input
            aria-label={ui("Speech zoom amount")}
            type="range"
            min={1.02}
            max={1.4}
            step={0.01}
            value={zoom}
            disabled={busy}
            className="mt-2 w-full accent-primary"
            onChange={e => setZoom(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={replacePath}
            disabled={busy}
            onChange={e => setReplacePath(e.target.checked)}
          />
          {ui("Replace existing motion")}
        </label>
        <button
          type="button"
          disabled={busy || !targets.length}
          onClick={() => void apply("zoom")}
          className={button}
        >
          {ui("Apply speech zoom")}
        </button>
      </section>
      {error ? (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
