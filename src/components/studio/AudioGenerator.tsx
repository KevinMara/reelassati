import { useState } from "react";
import type { Asset } from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

export function AudioGenerator({
  projectId,
  onInsert,
}: {
  projectId: string;
  onInsert: (asset: Asset) => Promise<void>;
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
        const asset = await platformApi.generateAudio({
          kind,
          seconds,
          text,
          acceptedCredits: quote,
          requestId: crypto.randomUUID(),
          rightsConfirmed: true,
          projectId,
        });
        // Store generated output in Library even if timeline insertion is interrupted.
        await onInsert(asset);
        setMessage("Generated audio added to your timeline and Library.");
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
    <div className="mb-5 rounded-xl border border-primary/30 bg-background p-4">
      <h3 className="mb-3 font-medium">
        Generate music & sound effects with AI
      </h3>
      <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_120px]">
        <select
          aria-label="Audio generation type"
          disabled={busy}
          value={kind}
          onChange={e => {
            setKind(e.target.value as "music" | "sfx");
            setQuote(null);
          }}
          className="rounded-lg border border-border bg-surface p-2"
        >
          <option value="music">Instrumental music</option>
          <option value="sfx">Sound effect</option>
        </select>
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
            min={3}
            max={kind === "music" ? 60 : 30}
            step={1}
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
          AI audio generation is not available yet. You can use the free audio
          below.
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
