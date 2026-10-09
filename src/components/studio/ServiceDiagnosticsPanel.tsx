import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  AiConnectionStatus,
  ServiceDiagnostics,
} from "@contracts/service-diagnostics";
import { captureUploadRequestScope, platformApi } from "@/lib/platform-api";
import { useAuth } from "@/hooks/useAuth";

const statusLabels: Record<AiConnectionStatus, string> = {
  "not-configured": "Setup needed",
  authenticated: "Key accepted",
  "key-limit-reached": "Key spending limit reached",
  "authorization-rejected": "Authorization rejected",
  "temporarily-unavailable": "Check unavailable",
  "invalid-response": "Unexpected response",
};

export function ServiceDiagnosticsPanel() {
  const { user } = useAuth();
  return (
    <ServiceDiagnosticsCheck
      key={user?.id ?? "signed-out"}
      signedIn={Boolean(user)}
    />
  );
}

function ServiceDiagnosticsCheck({ signedIn }: { signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ServiceDiagnostics | null>(null);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  async function check() {
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const scope = await captureUploadRequestScope();
      request.signal.throwIfAborted();
      const checked = await platformApi.serviceDiagnostics({
        scope,
        signal: request.signal,
      });
      if (mounted.current && !request.signal.aborted) setResult(checked);
    } catch {
      if (mounted.current && !request.signal.aborted)
        setError(
          "The service check could not complete. Sign in as the studio owner and retry."
        );
    } finally {
      if (mounted.current && controller.current === request) setBusy(false);
    }
  }

  return (
    <article className="mt-6 rounded-xl border border-border bg-background p-4">
      <h3 className="text-sm font-medium">Owner connection check</h3>
      <p className="mt-1 text-xs leading-relaxed text-foreground/65">
        Check OpenRouter key authentication and sound service settings. This
        check creates no media, spends no REELassati credits, and does not
        verify a generation.
      </p>
      <button
        type="button"
        disabled={busy || !signedIn}
        onClick={() => void check()}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-xs font-medium text-primary disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        {busy ? "Checking connections…" : "Check connections"}
      </button>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="mt-3 text-xs leading-relaxed"
      >
        {error ? <p className="text-destructive">{error}</p> : null}
        {result ? (
          <>
            <p className="font-medium">AI: {statusLabels[result.ai.status]}</p>
            <p className="mt-1 text-foreground/70">{result.ai.note}</p>
            <p className="mt-3 font-medium">
              Sound effects:{" "}
              {result.soundEffects.configured
                ? "Settings present"
                : "Setup needed"}
            </p>
            <p className="mt-1 text-foreground/70">
              {result.soundEffects.note}
            </p>
            {result.soundEffects.missing.length ? (
              <p className="mt-1 break-words font-mono text-foreground/70">
                {result.soundEffects.missing.join(", ")}
              </p>
            ) : null}
            <p className="mt-3 text-foreground/55">
              Checked {new Date(result.checkedAt).toLocaleString()}. Generation
              not tested.
            </p>
          </>
        ) : null}
      </div>
    </article>
  );
}
