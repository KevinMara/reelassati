import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CompactSelect } from "@/components/ui/compact-select";
import { trackVideoRegion } from "@/lib/region-tracking";
import { trackedGraphicClip } from "@/lib/tracked-graphic";
import type { TrackingRegion } from "@contracts/region-tracking";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { TimelinePreview } from "./TimelinePreview";

export function ObjectTrackingPanel({
  project,
  clip,
  assets,
  onApply,
}: {
  project: EditProject;
  clip: TimelineClip;
  assets: Asset[];
  onApply: (result: TimelineClip, source: TimelineClip) => Promise<void>;
}) {
  const sources = project.clips.filter(
    c =>
      !c.transitionHandle &&
      !c.graphic &&
      c.track !== "audio" &&
      c.start < clip.start + clip.duration &&
      c.start + c.duration > clip.start &&
      assets.some(
        a => a.id === c.assetId && a.kind === "video" && a.status === "ready"
      )
  );
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const source = sources.find(c => c.id === sourceId) ?? sources[0];
  const asset = assets.find(a => a.id === source?.assetId);
  const start = source ? Math.max(clip.start, source.start) : 0;
  const maximum = source
    ? Math.min(
        30,
        (Math.min(clip.start + clip.duration, source.start + source.duration) -
          start) *
          (source.speed ?? 1)
      )
    : 0;
  const [seconds, setSeconds] = useState(Math.min(5, maximum));
  const span = Math.min(seconds, maximum);
  const [region, setRegion] = useState<TrackingRegion>();
  const [ratio, setRatio] = useState(
    asset?.width && asset.height ? asset.width / asset.height : 16 / 9
  );
  const [progress, setProgress] = useState<number>();
  const [result, setResult] = useState<TimelineClip>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewTime, setPreviewTime] = useState(start);
  const videoRef = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ x: number; y: number } | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => abort.current?.abort(), []);
  const coordinate = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };
  const update = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const p = coordinate(e),
      a = drag.current;
    setRegion({
      x: Math.min(a.x, p.x),
      y: Math.min(a.y, p.y),
      width: Math.abs(p.x - a.x),
      height: Math.abs(p.y - a.y),
    });
  };
  const busy = progress !== undefined;
  if (!source || !asset)
    return (
      <p className="text-xs text-foreground/65">
        Add overlapping video footage to track this graphic.
      </p>
    );
  if (clip.graphic?.kind.startsWith("spatial-"))
    return (
      <p className="text-xs text-foreground/65">
        Region tracking attaches 2D graphics. Choose a text, callout, or vector
        shape.
      </p>
    );
  const sourceStart =
    source.inPoint + (start - source.start) * (source.speed ?? 1);
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-medium">
        Attach to moving region
      </legend>
      <p className="text-xs text-foreground/65">
        Draw around a distinctive edge, logo, or textured object. Tracking
        follows its 2D position and keeps your graphic’s initial offset. Review
        the path before applying it.
      </p>
      <CompactSelect
        aria-label="Tracking source clip"
        value={source.id}
        disabled={busy}
        onValueChange={value => {
          setSourceId(value);
          setRegion(undefined);
          setResult(undefined);
          setError("");
          setSeconds(5);
        }}
        options={sources.map(c => ({ value: c.id, label: c.label }))}
      />
      <div
        className="relative touch-none overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: ratio, cursor: busy ? "wait" : "crosshair" }}
        role="group"
        aria-label="Draw tracking region on source footage"
        onPointerDown={e => {
          if (busy) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = coordinate(e);
          setResult(undefined);
          setError("");
          update(e);
        }}
        onPointerMove={update}
        onPointerUp={e => {
          update(e);
          drag.current = undefined;
        }}
        onPointerCancel={() => {
          drag.current = undefined;
        }}
      >
        <video
          key={asset.id + sourceStart}
          ref={videoRef}
          crossOrigin="anonymous"
          src={asset.url}
          muted
          playsInline
          preload="auto"
          className="pointer-events-none h-full w-full object-contain"
          aria-label="Tracking seed frame"
          onLoadedMetadata={e => {
            const v = e.currentTarget;
            setRatio(v.videoWidth / v.videoHeight);
            v.currentTime = sourceStart;
          }}
          onError={() => setError("The source preview could not be loaded.")}
        />
        {region && (
          <div
            className="pointer-events-none absolute border-2 border-primary bg-primary/10"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.width * 100}%`,
              height: `${region.height * 100}%`,
            }}
          />
        )}
      </div>
      {region && (
        <div className="grid grid-cols-2 gap-2">
          {(["x", "y", "width", "height"] as const).map(key => (
            <label key={key} className="text-xs">
              Region {key} %
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                disabled={busy}
                className="mt-1 w-full rounded border border-border bg-background p-1.5"
                value={+(region[key] * 100).toFixed(1)}
                onChange={e => {
                  setRegion({ ...region, [key]: Number(e.target.value) / 100 });
                  setResult(undefined);
                }}
              />
            </label>
          ))}
        </div>
      )}
      {!region && (
        <button
          type="button"
          disabled={busy}
          className="text-xs text-primary"
          onClick={() => setRegion({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 })}
        >
          Set region with numeric controls
        </button>
      )}
      <label className="block text-xs">
        Source seconds to track · up to {maximum.toFixed(1)}s
        <input
          type="number"
          min={0.25}
          max={maximum}
          step={0.25}
          value={span}
          disabled={busy}
          className="ml-2 w-20 rounded border border-border bg-background p-1.5"
          onChange={e => {
            setSeconds(Number(e.target.value));
            setResult(undefined);
          }}
        />
      </label>
      {busy ? (
        <div className="flex items-center justify-between text-xs">
          <span role="status">
            Analysing decoded frames… {Math.round(progress * 100)}%
          </span>
          <button
            type="button"
            className="text-destructive"
            onClick={() => abort.current?.abort()}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!region || span <= 0 || clip.locked}
          className="rounded-lg border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-40"
          onClick={() => {
            if (!region) return;
            const controller = new AbortController();
            abort.current = controller;
            setProgress(0);
            setResult(undefined);
            setError("");
            void trackVideoRegion(
              asset.url,
              sourceStart,
              sourceStart + span,
              region,
              controller.signal,
              setProgress
            )
              .then(observed => {
                const tracked = trackedGraphicClip(
                  clip,
                  source,
                  observed.points,
                  observed,
                  project.aspectRatio
                );
                setResult(tracked);
                setPreviewTime(tracked.start);
              })
              .catch(e => {
                if (e?.name !== "AbortError")
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Tracking could not complete."
                  );
              })
              .finally(() => setProgress(undefined));
          }}
        >
          Track region · free
        </button>
      )}
      <p className="text-[11px] text-foreground/55">
        Stops on lost or ambiguous matches. Rotation, scale changes, scene cuts
        and occlusion may require a shorter interval. Applying replaces the
        motion path and limits the graphic to the observed interval.
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-2 rounded-lg border border-primary/30 p-2">
          <TimelinePreview
            project={{
              ...project,
              clips: project.clips.map(c => (c.id === clip.id ? result : c)),
            }}
            assets={assets}
            time={previewTime}
            playing={false}
          />
          <label className="block text-xs">
            Review tracked path · {(previewTime - result.start).toFixed(2)}s
            <input
              className="block w-full accent-primary"
              aria-label="Tracked graphic review time"
              type="range"
              min={result.start}
              max={result.start + result.duration - 0.001}
              step={1 / 30}
              value={previewTime}
              onChange={e => setPreviewTime(Number(e.target.value))}
            />
          </label>
          <p className="text-xs text-foreground/60">
            {result.graphic?.motion?.length} editable keyframes ·{" "}
            {result.duration.toFixed(2)}s observed
          </p>
          <button
            type="button"
            disabled={saving || clip.locked}
            className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-40"
            onClick={() => {
              setSaving(true);
              void onApply(result, source)
                .catch(e =>
                  setError(
                    e instanceof Error ? e.message : "Could not apply tracking."
                  )
                )
                .finally(() => setSaving(false));
            }}
          >
            Apply tracked path
          </button>
        </div>
      )}
    </fieldset>
  );
}
