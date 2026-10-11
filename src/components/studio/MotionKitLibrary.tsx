import { useEffect, useId, useState } from "react";
import { Play, Pause, Layers } from "lucide-react";
import {
  MOTION_KITS,
  isMotionKitLogo,
  motionKitClips,
  type MotionKitDraft,
} from "@contracts/motion-kits";
import type { Asset, EditProject } from "@contracts/workspace";
import { CompactSelect } from "@/components/ui/compact-select";
import { TimelinePreview } from "./TimelinePreview";

export function MotionKitLibrary({
  project,
  assets,
  onInsert,
}: {
  project: EditProject;
  assets: Asset[];
  onInsert: (draft: MotionKitDraft) => Promise<void>;
}) {
  const controlId = useId();
  const [draft, setDraft] = useState<MotionKitDraft>({
    kit: "brand-reveal",
    title: MOTION_KITS[0].title,
    subtitle: MOTION_KITS[0].subtitle,
    seconds: 4,
    accent: "#7AF5CF",
    value: 42,
  });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!playing || !Number.isFinite(draft.seconds) || draft.seconds < 1)
      return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      setTime(((now - started) / 1000) % draft.seconds);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, draft.seconds]);
  const patch = (value: Partial<MotionKitDraft>) => {
    setDraft(current => ({ ...current, ...value }));
    setMessage("");
  };
  let preview: ReturnType<typeof motionKitClips> = [];
  try {
    preview = motionKitClips(draft, assets, 0, "kit-preview");
  } catch {
    /* Invalid draft fields remain editable. */
  }
  const field =
    "mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm";
  return (
    <section className="space-y-3" aria-label="Motion kits">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Motion kits</h3>
        <span className="text-xs text-muted-foreground">
          Free · editable layers
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Original animations rendered on your device. Customize, insert, then
        refine each layer on the timeline.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {MOTION_KITS.map(kit => (
          <button
            type="button"
            key={kit.id}
            disabled={busy}
            aria-pressed={draft.kit === kit.id}
            title={kit.detail}
            onClick={() =>
              patch({
                kit: kit.id,
                title: kit.title,
                subtitle: kit.subtitle,
                seconds: kit.seconds,
                logoAssetId: undefined,
              })
            }
            className="rounded-lg border border-border p-3 text-left text-xs aria-pressed:border-primary aria-pressed:bg-primary/10 disabled:opacity-50"
          >
            {kit.name}
          </button>
        ))}
      </div>
      <div
        className="mx-auto overflow-hidden rounded-lg"
        style={{
          maxWidth:
            project.aspectRatio === "9:16"
              ? 146
              : project.aspectRatio === "1:1"
                ? 260
                : "100%",
        }}
      >
        <TimelinePreview
          project={{
            ...project,
            clips: preview,
            transcript: [],
            trackSettings: [],
            duration: draft.seconds,
          }}
          assets={assets}
          time={Math.max(0, Math.min(time, draft.seconds - 1 / 30))}
          playing={false}
        />
      </div>
      <button
        type="button"
        onClick={() => setPlaying(value => !value)}
        className="flex items-center gap-2 text-xs"
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
        {playing ? "Pause preview" : "Play preview"}
      </button>
      <form
        className="space-y-3"
        onSubmit={event => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          void onInsert(structuredClone(draft))
            .then(() =>
              setMessage(
                "Added at the playhead. Select the layers to refine them; Undo removes the whole kit."
              )
            )
            .catch(cause =>
              setMessage(
                cause instanceof Error
                  ? cause.message
                  : "Could not insert this motion kit."
              )
            )
            .finally(() => setBusy(false));
        }}
      >
        <label className="block text-xs">
          {draft.kit === "statistic" ? "Result label" : "Main text"}
          <input
            required
            disabled={busy}
            maxLength={80}
            value={draft.title}
            onChange={event => patch({ title: event.target.value })}
            className={field}
          />
        </label>
        <label className="block text-xs">
          Supporting text
          <input
            disabled={busy}
            maxLength={120}
            value={draft.subtitle}
            onChange={event => patch({ subtitle: event.target.value })}
            className={field}
          />
        </label>
        {draft.kit === "statistic" && (
          <label className="block text-xs">
            Measured percentage
            <input
              required
              disabled={busy}
              type="number"
              min={0}
              max={100}
              value={draft.value ?? 0}
              onChange={event => patch({ value: Number(event.target.value) })}
              className={field}
            />
          </label>
        )}
        {draft.kit === "brand-reveal" && (
          <label className="block text-xs" htmlFor={`${controlId}-logo`}>
            Logo from Library
            <CompactSelect
              id={`${controlId}-logo`}
              aria-label="Logo from Library"
              disabled={busy}
              value={draft.logoAssetId ?? "none"}
              onValueChange={value =>
                patch({ logoAssetId: value === "none" ? undefined : value })
              }
              options={[
                { value: "none", label: "Wordmark only" },
                ...assets
                  .filter(isMotionKitLogo)
                  .map(asset => ({ value: asset.id, label: asset.name })),
              ]}
            />
            <span className="text-muted-foreground">
              Use a transparent PNG or WebP for a logo without a background.
            </span>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            Accent color
            <input
              disabled={busy}
              type="color"
              value={draft.accent}
              onChange={event => patch({ accent: event.target.value })}
              className={field}
            />
          </label>
          <label className="block text-xs">
            Duration (seconds)
            <input
              required
              disabled={busy}
              type="number"
              min={1}
              max={30}
              step={0.5}
              value={draft.seconds}
              onChange={event => patch({ seconds: Number(event.target.value) })}
              className={field}
            />
          </label>
        </div>
        {message && (
          <p role="status" className="text-xs text-foreground/75">
            {message}
          </p>
        )}
        <button
          disabled={busy}
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary p-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Layers size={16} />
          {busy ? "Adding…" : "Add kit at playhead"}
        </button>
      </form>
    </section>
  );
}
