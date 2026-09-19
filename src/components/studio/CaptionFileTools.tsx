import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { TranscriptSegment } from "@contracts/workspace";
import { exportSrt, parseSubtitleFile } from "@/lib/subtitle-files";

export function CaptionFileTools({
  segments,
  duration,
  onImport,
}: {
  segments: readonly TranscriptSegment[];
  duration: number;
  onImport: (segments: TranscriptSegment[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<ReturnType<
    typeof parseSubtitleFile
  > | null>(null);
  const apply = (result: ReturnType<typeof parseSubtitleFile>) => {
    onImport(result.segments);
    setNotice(
      `Imported ${result.segments.length} captions.${result.skipped ? ` ${result.skipped} invalid or out-of-range cues skipped.` : ""}${result.clipped ? ` ${result.clipped} cues trimmed to the video end.` : ""}`
    );
    setPending(null);
  };
  const download = () => {
    const blob = new Blob([exportSrt(segments, duration)], {
      type: "application/x-subrip;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "captions.srt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs"
        >
          <Upload size={13} />
          Import SRT / VTT
        </button>
        <button
          type="button"
          disabled={!segments.length}
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs disabled:opacity-40"
        >
          <Download size={13} />
          Download SRT
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        className="hidden"
        aria-label="Import subtitle file"
        onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            if (file.size > 2_000_000)
              throw new Error("Choose a subtitle file smaller than 2 MB.");
            const result = parseSubtitleFile(await file.text(), duration);
            if (segments.length) {
              setPending(result);
              setNotice("");
            } else apply(result);
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : "Could not import these captions."
            );
          }
        }}
      />
      {pending && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <p>
            Replace {segments.length} existing captions with{" "}
            {pending.segments.length} imported captions?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => apply(pending)}
              className="rounded-md bg-primary px-2.5 py-1.5 text-primary-foreground"
            >
              Replace captions
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md border border-border px-2.5 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
