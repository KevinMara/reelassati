import { useEffect, useRef, useState } from "react";
import { platformApi } from "@/lib/platform-api";
export function VoicePreview({ voice }: { voice: string }) {
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );
  async function preview() {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const r = await platformApi.voicePreview(voice);
      if (generation.current === current) setUrl(r.url);
    } catch (e) {
      if (generation.current === current)
        setError(e instanceof Error ? e.message : "Preview unavailable.");
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  return (
    <div className="mt-3">
      {url ? (
        <audio
          key={url}
          controls
          autoPlay
          src={url}
          className="h-10 w-full"
          aria-label="Selected voice preview"
        />
      ) : (
        <button
          type="button"
          onClick={() => void preview()}
          disabled={busy}
          className="rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary disabled:opacity-60"
        >
          {busy ? "Preparing preview…" : "Listen to a preview"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
