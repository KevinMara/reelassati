import { useUiText } from "@/lib/i18n/ui";
import { useMemo, useState } from "react";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  buildTranscriptCutPlan,
  getTranscriptCutWords,
  transcriptWordSelectionKey,
  type TranscriptWordSelection,
} from "@/lib/transcript-cuts";

interface TranscriptCutPanelProps {
  project: EditProject;
  assets: Asset[];
  busy?: boolean;
  onCut: (selections: TranscriptWordSelection[]) => void | Promise<unknown>;
  canRestore: boolean;
  onRestore: () => void | Promise<unknown>;
}

/** Changing the real project snapshot remounts the selection state, including on
 * undo/redo. Old word indices are discarded when canonical cut inputs change. */
export function TranscriptCutPanel(props: TranscriptCutPanelProps) {
  const scope = useMemo(() => {
    const value = JSON.stringify([
      props.project.id,
      props.project.updatedAt,
      props.project.revisionIndex,
      props.project.clips,
      props.project.transcript,
      props.project.trackSettings,
      props.assets.map(asset => [
        asset.id,
        asset.status,
        asset.kind,
        asset.duration,
        asset.url,
      ]),
    ]);
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++)
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return `${props.project.id}:${(hash >>> 0).toString(36)}`;
  }, [props.project, props.assets]);
  return <TranscriptCutPanelBody key={scope} {...props} />;
}

function TranscriptCutPanelBody({
  project,
  assets,
  busy = false,
  onCut,
  canRestore,
  onRestore,
}: TranscriptCutPanelProps) {
  const ui = useUiText();
  const [selected, setSelected] = useState<TranscriptWordSelection[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const words = useMemo(
    () => getTranscriptCutWords(project, assets),
    [project, assets]
  );
  const groups = useMemo(
    () =>
      project.transcript
        .map(segment => ({
          id: segment.id,
          words: words.filter(word => word.segmentId === segment.id),
        }))
        .filter(group => group.words.length),
    [project.transcript, words]
  );
  const selectedKeys = new Set(selected.map(transcriptWordSelectionKey));
  let removedDuration = 0;
  let validationError = "";
  if (selected.length) {
    try {
      removedDuration = buildTranscriptCutPlan(
        project,
        assets,
        selected
      ).removedDuration;
    } catch (error) {
      validationError =
        error instanceof Error
          ? error.message
          : "These words cannot be cut from the current edit.";
    }
  }
  const disabled = busy || pending;
  const perform = async (action: () => void | Promise<unknown>) => {
    if (disabled) return;
    setPending(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The edit could not be saved. Try again."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-background/50 p-4"
      aria-label={ui("Cut footage from transcript")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{ui("Cut footage by word")}</h3>
        <button
          type="button"
          disabled={disabled || !canRestore}
          onKeyDown={event => event.stopPropagation()}
          onClick={() => void perform(onRestore)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {ui("Restore last transcript cut")}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-foreground/65">
        {ui(
          "Select spoken words to remove their measured time from the footage, audio and other unlocked tracks, closing the gaps. No AI credits."
        )}
      </p>
      {!words.length ? (
        <p className="rounded-lg border border-border p-3 text-xs text-foreground/65">
          {ui(
            "Word cuts need measured word timings attached to audible video or audio. Captions without them remain editable in the caption controls."
          )}
        </p>
      ) : (
        <>
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
            {groups.map(group => (
              <div
                key={group.id}
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={`Spoken words from ${group.words[0].start.toFixed(2)} seconds`}
              >
                {group.words.map(word => {
                  const wordKey = transcriptWordSelectionKey(word);
                  const active = selectedKeys.has(wordKey);
                  return (
                    <button
                      type="button"
                      key={wordKey}
                      disabled={disabled}
                      aria-pressed={active}
                      aria-label={`${active ? ui("Deselect") : ui("Select")} ${word.text}, ${word.start.toFixed(2)} to ${word.end.toFixed(2)} seconds`}
                      title={`${word.start.toFixed(3)}–${word.end.toFixed(3)} s`}
                      onKeyDown={event => event.stopPropagation()}
                      onClick={() => {
                        setSelected(current =>
                          active
                            ? current.filter(
                                selection =>
                                  transcriptWordSelectionKey(selection) !==
                                  wordKey
                              )
                            : [
                                ...current,
                                {
                                  segmentId: word.segmentId,
                                  wordIndex: word.wordIndex,
                                },
                              ]
                        );
                        setError("");
                      }}
                      className={`rounded-md border px-2 py-1 text-sm transition-colors disabled:opacity-40 ${active ? "border-destructive bg-destructive/10 text-destructive" : "border-border hover:border-primary/50 hover:bg-primary/5"}`}
                    >
                      {word.text}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || !selected.length}
              onKeyDown={event => event.stopPropagation()}
              onClick={() => {
                setSelected([]);
                setError("");
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
            >
              {ui("Clear selection")}
            </button>
            <span
              className="flex-1 text-xs text-foreground/65"
              aria-live="polite"
            >
              {selected.length
                ? `${selected.length} ${selected.length === 1 ? ui("word") : ui("words")} selected${validationError ? "" : ` · ${removedDuration.toFixed(3)} s removed`}`
                : ui("Select words to cut")}
            </span>
            <button
              type="button"
              disabled={
                disabled || !selected.length || Boolean(validationError)
              }
              onKeyDown={event => event.stopPropagation()}
              onClick={() =>
                void perform(() =>
                  onCut(selected.map(selection => ({ ...selection })))
                )
              }
              className="rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-40"
            >
              {pending ? ui("Saving…") : ui("Cut selected words")}
            </button>
          </div>
        </>
      )}
      {(error || validationError) && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error || validationError}
        </p>
      )}
    </section>
  );
}
