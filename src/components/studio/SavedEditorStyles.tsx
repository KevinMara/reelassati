import { useUiText } from "@/lib/i18n/ui";
import { StudioSelect } from "@/components/ui/studio-select";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, SlidersHorizontal, Trash2 } from "lucide-react";
import type { EditProject, TimelineClip } from "@contracts/workspace";
import {
  captureEditorStyle,
  normalizeEditorSavedStyles,
  EDITOR_SAVED_STYLE_LIMIT,
  type EditorSavedStyle,
  type EditorSavedStyleDraft,
  type EditorSavedStyleType,
} from "@contracts/editor-style-library";
import { CaptionStylePreview } from "./CaptionStylePreview";
import { MotionGraphicLayer } from "./MotionGraphicLayer";

export interface SavedEditorStylesProps {
  styles: readonly EditorSavedStyle[];
  selectedClip?: TimelineClip | null;
  project: EditProject;
  time: number;
  onSave(style: EditorSavedStyleDraft): void | Promise<void>;
  onApply(style: EditorSavedStyle): void | Promise<void>;
  onDelete(id: string): void | Promise<void>;
  disabled?: boolean;
  focusedStyleId?: string;
}

const typeNames = {
  graphic: "Graphic",
  captions: "Captions",
  look: "Clip look",
};

/** Captures native editable settings; applying a graphic inserts an independent copy. */
export function SavedEditorStyles({
  styles,
  selectedClip,
  project,
  time,
  onSave,
  onApply,
  onDelete,
  disabled = false,
  focusedStyleId,
}: SavedEditorStylesProps) {
  const ui = useUiText();
  const [name, setName] = useState("");
  const [type, setType] = useState<EditorSavedStyleType>(
    selectedClip?.graphic ? "graphic" : "captions"
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const styleList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusedStyleId) return;
    const frame = requestAnimationFrame(() => {
      const element = Array.from(
        styleList.current?.querySelectorAll<HTMLElement>(
          "[data-saved-style]"
        ) ?? []
      ).find(item => item.dataset.savedStyle === focusedStyleId);
      element?.scrollIntoView({ block: "nearest", inline: "nearest" });
      element?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedStyleId]);
  const saved = useMemo(() => normalizeEditorSavedStyles(styles), [styles]);
  const inClip =
    selectedClip &&
    time >= selectedClip.start &&
    time < selectedClip.start + selectedClip.duration;
  const canSave =
    type === "captions" ||
    (type === "graphic"
      ? Boolean(selectedClip?.graphic)
      : Boolean(
          selectedClip?.track === "video" &&
          selectedClip.assetId &&
          !selectedClip.transitionHandle &&
          inClip
        ));
  const blocked = disabled || Boolean(busy);
  const run = async (action: string, task: () => void | Promise<void>) => {
    if (blocked) return;
    setError("");
    setBusy(action);
    try {
      await task();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.slice(0, 280)
          : "This style change could not be saved."
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <section
      aria-label={ui("Saved editor styles")}
      className="space-y-3 border-t border-border pt-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{ui("Saved styles")}</h3>
        <span className="text-[11px] text-muted-foreground">
          {saved.length}/{EDITOR_SAVED_STYLE_LIMIT} {ui("· editable")}
        </span>
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-background/30 p-3">
        <label
          htmlFor={`saved-style-kind-${project.id}`}
          className="block space-y-1 text-xs"
        >
          <span className="text-muted-foreground">{ui("Capture")}</span>
          <StudioSelect
            id={`saved-style-kind-${project.id}`}
            value={type}
            disabled={blocked}
            onChange={event =>
              setType(event.target.value as EditorSavedStyleType)
            }
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="graphic">
              {ui("Selected graphic and its full animation")}
            </option>
            <option value="captions">{ui("Project caption style")}</option>
            <option value="look">
              {ui("Selected clip pose and grade at playhead")}
            </option>
          </StudioSelect>
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">{ui("Style name")}</span>
          <input
            value={name}
            maxLength={60}
            disabled={blocked}
            onChange={event => setName(event.target.value)}
            placeholder={ui("Name this style")}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
          />
        </label>
        <button
          type="button"
          disabled={
            blocked ||
            !canSave ||
            !name.trim() ||
            saved.length >= EDITOR_SAVED_STYLE_LIMIT
          }
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary/15 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-40"
          onClick={() =>
            void run("save", async () => {
              const draft = captureEditorStyle(
                type,
                name,
                selectedClip,
                project,
                time
              );
              await onSave(draft);
              setName("");
            })
          }
        >
          <BookmarkPlus size={14} />
          {busy === "save" ? ui("Saving…") : ui("Save style")}
        </button>
        {!canSave && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {type === "graphic"
              ? ui(
                  "Select an editable graphic to capture its text, shape and motion."
                )
              : ui(
                  "Select a video or image and move the playhead inside it to capture the current pose and grade."
                )}
          </p>
        )}
        {canSave && type === "graphic" && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {ui(
              "The full graphic animation is saved. Apply it to insert a new editable graphic."
            )}
          </p>
        )}
        {saved.length >= EDITOR_SAVED_STYLE_LIMIT && (
          <p className="text-[11px] text-muted-foreground">
            {ui("Delete a saved style to make room for another.")}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      {saved.length > 0 && (
        <label className="block">
          <span className="sr-only">{ui("Search saved styles")}</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={ui("Search saved styles…")}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
          />
        </label>
      )}
      <div ref={styleList} className="grid grid-cols-2 gap-2">
        {saved
          .filter(style =>
            `${style.name} ${typeNames[style.type]}`
              .toLowerCase()
              .includes(query.toLowerCase())
          )
          .map(style => {
            const canApply =
              style.type !== "look" ||
              Boolean(
                selectedClip?.track === "video" &&
                selectedClip.assetId &&
                !selectedClip.locked &&
                !selectedClip.transitionHandle
              );
            return (
              <article
                key={style.id}
                data-saved-style={style.id}
                tabIndex={-1}
                className={`min-w-0 rounded-xl border p-2 ${focusedStyleId === style.id ? "border-primary/50" : "border-border"}`}
              >
                <SavedStylePreview style={style} />
                <p
                  className="mt-2 truncate text-xs font-medium"
                  title={style.name}
                >
                  {style.name}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {typeNames[style.type]}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={blocked || !canApply}
                    title={
                      canApply
                        ? ui("Apply {{name}}", { name: style.name })
                        : ui(
                            "Select an unlocked video or image to apply this look."
                          )
                    }
                    onClick={() =>
                      void run(`apply:${style.id}`, () => onApply(style))
                    }
                    className="flex-1 rounded-md border border-border px-2 py-1.5 text-[11px] hover:border-primary/60 disabled:opacity-40"
                  >
                    {busy === `apply:${style.id}`
                      ? ui("Applying…")
                      : style.type === "graphic"
                        ? ui("Insert")
                        : ui("Apply")}
                  </button>
                  <button
                    type="button"
                    disabled={blocked}
                    aria-label={ui("Delete saved style {{name}}", {
                      name: style.name,
                    })}
                    onClick={() =>
                      void run(`delete:${style.id}`, () => onDelete(style.id))
                    }
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </article>
            );
          })}
      </div>
      {!saved.length && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {ui(
            "Save a graphic, caption style or clip look to reuse it across your projects."
          )}
        </p>
      )}
    </section>
  );
}

function SavedStylePreview({ style }: { style: EditorSavedStyle }) {
  const ui = useUiText();
  if (style.type === "captions")
    return (
      <CaptionStylePreview
        presetId={style.captionStyle}
        appearance={style.captionAppearance}
      />
    );
  if (style.type === "graphic") {
    const clip: TimelineClip = {
      id: style.id,
      label: style.name,
      track: "overlay",
      start: 0,
      duration: style.graphicDuration,
      inPoint: 0,
      outPoint: style.graphicDuration,
      graphicDuration: style.graphicDuration,
      graphic: style.graphic,
      locked: false,
      color: style.graphic.background,
    };
    return (
      <div
        className="relative aspect-video overflow-hidden rounded-lg bg-[#252A32]"
        style={{ containerType: "inline-size" }}
      >
        <MotionGraphicLayer
          clip={clip}
          time={Math.min(0.8, style.graphicDuration / 2)}
        />
      </div>
    );
  }
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-lg bg-foreground/5 text-muted-foreground">
      <SlidersHorizontal size={19} />
      <span className="text-[9px]">
        {ui("Brightness")} {style.settings.brightness.toFixed(2)}
      </span>
      <span className="text-[9px]">
        {ui("Contrast")} {style.settings.contrast.toFixed(2)} {ui("· Color")}{" "}
        {style.settings.saturation.toFixed(2)}
      </span>
      <span className="text-[9px]">
        {ui("Opacity")} {Math.round(style.settings.visual.opacity * 100)}% ·
        Zoom {Math.round(style.settings.visual.scale * 100)}%
      </span>
    </div>
  );
}
