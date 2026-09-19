import { useState } from "react";
import { CompactSelect } from "@/components/ui/compact-select";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

export function AudioGenerator({
  onGenerate,
}: {
  onGenerate: (input: {
    kind: "music" | "sfx";
    seconds: number;
    text: string;
    acceptedCredits: number;
  }) => Promise<void>;
}) {
  const { capabilities } = useWorkspace();
  const [kind, setKind] = useState<"music" | "sfx">("music");
  const [seconds, setSeconds] = useState(15);
  const [text, setText] = useState("");
  const [quote, setQuote] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ready =
    kind === "music"
      ? capabilities.musicGeneration
      : capabilities.soundGeneration;
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      if (quote === null) {
        setQuote((await platformApi.quoteAudio(kind, seconds)).credits);
      } else {
        await onGenerate({ kind, seconds, text, acceptedCredits: quote });
        setMessage(
          "Generation started. Your audio will appear in Generated files and Library."
        );
        setQuote(null);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not generate audio.");
      setQuote(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-4 rounded-xl border border-border bg-background/50 p-3">
      <h3 className="mb-3 text-sm font-medium">
        Generate music & sound effects with AI
      </h3>
      <div className="grid min-w-0 gap-3">
        <CompactSelect
          aria-label="Audio generation type"
          disabled={busy}
          value={kind}
          onValueChange={value => {
            setKind(value as "music" | "sfx");
            setSeconds(s =>
              Math.min(30, Math.max(value === "music" ? 3 : 0.5, s))
            );
            setQuote(null);
          }}
          options={[
            { value: "music", label: "Instrumental music" },
            { value: "sfx", label: "Sound effect" },
          ]}
          className="w-full"
        />
        <textarea
          aria-label="Describe generated audio"
          disabled={busy}
          value={text}
          maxLength={4000}
          onChange={e => {
            setText(e.target.value);
            setQuote(null);
          }}
          placeholder="Describe mood, instruments, rhythm, or the sound you need…"
          rows={2}
          className="rounded-lg border border-border bg-surface p-2 text-sm"
        />
        <label className="text-sm">
          Seconds
          <input
            type="range"
            aria-label="AI audio duration"
            disabled={busy}
            min={kind === "music" ? 3 : 0.5}
            max={30}
            step={0.5}
            value={seconds}
            onChange={e => {
              setSeconds(Number(e.target.value));
              setQuote(null);
            }}
            className="w-full accent-primary"
          />
          {seconds.toFixed(1)}s
        </label>
      </div>
      <button
        type="button"
        disabled={busy || !ready || !text.trim()}
        onClick={() => void submit()}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
      >
        {busy
          ? "Please wait…"
          : quote === null
            ? "Get credit quote"
            : `Generate · ${quote} credits`}
      </button>
      {!ready && (
        <p className="mt-2 text-sm text-foreground/70">
          {kind === "music" ? "Music generation" : "Sound-effect generation"} is
          not available yet. You can use the free sounds below or upload audio
          to Library.
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
