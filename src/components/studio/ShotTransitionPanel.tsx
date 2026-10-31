import { useWorkspace } from "@/providers/workspace";
import {
  TRANSITION_PRESETS,
  normalizeTransitionPresets,
} from "@contracts/transition-presets";
import { selectedBrand } from "@/lib/workspace-scope";
import { Download, Upload } from "lucide-react";
import { useUiText } from "@/lib/i18n/ui";
import { useRef, useState } from "react";
import { CompactSelect } from "@/components/ui/compact-select";
import { PresetPreview } from "./PresetPreview";
import {
  visualTransitions,
  type VisualTransition,
} from "@contracts/clip-visual";
import type { EditProject, TimelineClip } from "@contracts/workspace";

export function ShotTransitionPanel({
  clip,
  project,
  disabled,
  onApply,
  onRemove,
}: {
  clip?: TimelineClip;
  project: EditProject;
  disabled: boolean;
  onApply: (
    incomingId: string,
    kind: Exclude<VisualTransition, "none">,
    duration: number
  ) => Promise<void>;
  onRemove: (outgoingId: string, incomingId: string) => Promise<void>;
}) {
  const ui = useUiText();
  const { workspace, updateWorkspace } = useWorkspace();
  const [personalName, setPersonalName] = useState("");
  const [personalId, setPersonalId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const personal = normalizeTransitionPresets(workspace.transitionPresets);
  const [kind, setKind] =
    useState<Exclude<VisualTransition, "none">>("dissolve");
  const [seconds, setSeconds] = useState(0.4),
    [error, setError] = useState("");
  const pair = project.clips.find(
    c =>
      c.shotTransition &&
      (c.shotTransition.outgoingId === clip?.id ||
        c.shotTransition.incomingId === clip?.id)
  )?.shotTransition;
  const next =
    clip &&
    !clip.graphic &&
    project.clips.find(
      c =>
        c.id !== clip.id &&
        !c.transitionHandle &&
        !c.graphic &&
        c.assetId &&
        c.track !== "audio" &&
        Math.abs(c.start - clip.start - clip.duration) < 0.001
    );
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-medium">
        {ui("Transition to next shot")}
      </legend>
      <p className="text-xs text-foreground/65">
        {next
          ? `${clip?.label} → ${next.label}`
          : ui(
              "Select an outgoing video shot that meets another video at its end."
            )}
      </p>
      <div
        className="grid grid-cols-2 gap-2"
        aria-label={ui("Transition presets")}
      >
        {TRANSITION_PRESETS.map(p => (
          <article
            key={p.id}
            className="min-w-0 rounded-lg border border-border p-1.5"
          >
            <PresetPreview
              name={`${ui(p.name)} · ${p.duration}s`}
              transition={p.kind}
              seconds={p.duration}
            />
            <button
              key={p.id}
              type="button"
              disabled={disabled || saving}
              onClick={() => {
                setKind(p.kind);
                setSeconds(p.duration);
                setPersonalId(undefined);
                setPersonalName(`${ui(p.name)} ${p.duration}s`);
              }}
              aria-pressed={
                kind === p.kind && seconds === p.duration && !personalId
              }
              className="mt-1 flex w-full items-center justify-between gap-1 rounded px-1 py-1.5 text-left text-[11px] aria-pressed:bg-primary/15 aria-pressed:text-primary disabled:opacity-40"
            >
              <span className="block truncate">{ui(p.name)}</span>
              <span className="text-foreground/50">{p.duration}s</span>
            </button>
          </article>
        ))}
      </div>
      <details className="rounded-md border border-border p-2 text-xs">
        <summary className="cursor-pointer">
          {ui("Personal styles")} · {personal.length}
        </summary>
        <div className="mt-2 space-y-2">
          {personal.map(p => (
            <button
              key={p.id}
              type="button"
              className="block w-full rounded border border-border p-2 text-left"
              onClick={() => {
                setPersonalId(p.id);
                setPersonalName(p.name);
                setKind(p.kind);
                setSeconds(p.duration);
              }}
            >
              {p.name} · {p.duration}s
            </button>
          ))}
          <input
            aria-label={ui("Style name")}
            placeholder={ui("Name this style")}
            maxLength={60}
            value={personalName}
            onChange={e => setPersonalName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || saving || !personalName.trim()}
              className="rounded border border-border px-2 py-1.5"
              onClick={async () => {
                const owner = workspace.profile.email.toLowerCase(),
                  brand = selectedBrand(owner);
                setSaving(true);
                setError("");
                try {
                  const preset = {
                    id: personalId ?? crypto.randomUUID(),
                    name: personalName,
                    kind,
                    duration: seconds,
                  };
                  if (!normalizeTransitionPresets([preset]).length)
                    throw new Error(
                      "This preset contains unsupported settings."
                    );
                  await updateWorkspace(current => {
                    if (
                      current.profile.email.toLowerCase() !== owner ||
                      selectedBrand(owner) !== brand
                    )
                      throw new Error(
                        "The destination workspace changed. Start the import again."
                      );
                    const existing = normalizeTransitionPresets(
                      current.transitionPresets
                    );
                    if (
                      !existing.some(p => p.id === preset.id) &&
                      existing.length >= 500
                    )
                      throw new Error("You can save up to 500 styles.");
                    return {
                      ...current,
                      transitionPresets: [
                        ...existing.filter(p => p.id !== preset.id),
                        preset,
                      ],
                    };
                  });
                  setPersonalId(preset.id);
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : "Save failed"
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              {ui("Save style")}
            </button>
            <button
              type="button"
              aria-label={ui("Import preset")}
              onClick={() => importInput.current?.click()}
              className="rounded border border-border p-1.5"
            >
              <Upload size={14} />
            </button>
            <button
              type="button"
              disabled={!personalName.trim()}
              aria-label={ui("Export preset")}
              className="rounded border border-border p-1.5"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      JSON.stringify(
                        {
                          format: "reel-transition",
                          version: 1,
                          preset: {
                            name: personalName,
                            kind,
                            duration: seconds,
                          },
                        },
                        null,
                        2
                      ),
                    ],
                    { type: "application/json" }
                  )
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "transition.reel-preset.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={14} />
            </button>
          </div>
          <input
            ref={importInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                if (file.size > 256000)
                  throw new Error("This preset file is too large.");
                const doc = JSON.parse(await file.text());
                const p =
                  doc.format === "reel-transition" && doc.version === 1
                    ? normalizeTransitionPresets([
                        { ...doc.preset, id: "imported" },
                      ])[0]
                    : undefined;
                if (!p)
                  throw new Error("This preset contains unsupported settings.");
                setPersonalId(undefined);
                setPersonalName(p.name);
                setKind(p.kind);
                setSeconds(p.duration);
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Import failed"
                );
              }
            }}
          />
        </div>
      </details>
      <CompactSelect
        aria-label={ui("Transition between shots")}
        value={kind}
        onValueChange={v => setKind(v as typeof kind)}
        options={visualTransitions.filter(v => v.value !== "none")}
        disabled={disabled || saving}
      />
      <label className="block text-xs">
        {ui("Duration")}{" "}
        <input
          type="number"
          aria-label={ui("Shot transition duration")}
          min={0.05}
          max={5}
          step={0.05}
          value={seconds}
          disabled={disabled || saving}
          onChange={e => setSeconds(Number(e.target.value))}
          className="ml-2 w-20 rounded border border-border bg-background p-2"
        />{" "}
        s
      </label>
      <p className="text-xs text-foreground/55">
        {ui(
          "Uses unused footage around the cut. Speech timing and total edit length stay fixed. Other overlapping video layers must be resolved first."
        )}
      </p>
      <button
        type="button"
        disabled={disabled || !next}
        className="rounded-lg border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-40"
        onClick={() => {
          if (!next) return;
          setError("");
          void onApply(next.id, kind, seconds).catch(e =>
            setError(
              e instanceof Error ? e.message : "Could not apply transition."
            )
          );
        }}
      >
        {ui("Apply between shots")}
      </button>
      {pair && (
        <div className="space-y-2">
          <p className="text-xs text-foreground/65">
            {ui(
              "Remove this transition before moving, trimming, splitting or deleting its shots."
            )}
          </p>
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"
            onClick={() => {
              setError("");
              void onRemove(pair.outgoingId, pair.incomingId).catch(e =>
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not remove transition."
                )
              );
            }}
          >
            {ui("Remove transition")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
