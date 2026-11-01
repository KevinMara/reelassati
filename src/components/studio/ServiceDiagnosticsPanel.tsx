import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  AiConnectionStatus,
  ServiceDiagnostics,
} from "@contracts/service-diagnostics";
import { captureUploadRequestScope, platformApi } from "@/lib/platform-api";
import { useAuth } from "@/hooks/useAuth";
import { selectedBrand } from "@/lib/workspace-scope";

export function ServiceDiagnosticsPanel() {
  const { user } = useAuth();
  return (
    <ServiceDiagnosticsCheck
      key={JSON.stringify([
        user?.id,
        user?.email.toLowerCase(),
        selectedBrand(user?.email),
      ])}
      signedIn={Boolean(user)}
    />
  );
}

function ServiceDiagnosticsCheck({ signedIn }: { signedIn: boolean }) {
  const ui = useUiText();
  const statusLabels: Record<AiConnectionStatus, string> = {
    "not-configured": ui("Setup needed"),
    authenticated: ui("Key accepted"),
    "key-limit-reached": ui("Key spending limit reached"),
    "authorization-rejected": ui("Authorization rejected"),
    "temporarily-unavailable": ui("Check unavailable"),
    "invalid-response": ui("Unexpected response"),
  };
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
      if (
        mounted.current &&
        controller.current === request &&
        !request.signal.aborted
      )
        setResult(checked);
    } catch {
      if (
        mounted.current &&
        controller.current === request &&
        !request.signal.aborted
      )
        setError(
          ui(
            "The service check could not complete. Sign in as the studio owner and retry."
          )
        );
    } finally {
      if (mounted.current && controller.current === request) setBusy(false);
    }
  }

  return (
    <article className="mt-4 rounded-lg border border-primary/15 bg-primary/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{ui("Owner connection check")}</h3>
        <button
          type="button"
          disabled={busy || !signedIn}
          onClick={() => void check()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary/35 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {busy ? ui("Checking connections…") : ui("Check connections")}
        </button>
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-foreground/65">
        {ui(
          "Check OpenRouter key authentication and sound service settings. This check creates no media, spends no REELassati credits, and does not verify a generation."
        )}
      </p>
      <div
        aria-live="polite"
        aria-atomic="true"
        className={`${error || result ? "mt-3 border-t border-border pt-3" : ""} text-xs leading-relaxed`}
      >
        {error ? <p className="text-destructive">{error}</p> : null}
        {result ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-medium">
                  {ui("AI:")} {statusLabels[result.ai.status]}
                </p>
                <p className="mt-1 text-foreground/70">{result.ai.note}</p>
              </div>
              <div>
                <p className="font-medium">
                  {ui("Sound effects:")}{" "}
                  {result.soundEffects.configured
                    ? ui("Settings present")
                    : ui("Setup needed")}
                </p>
                <p className="mt-1 text-foreground/70">
                  {result.soundEffects.note}
                </p>
                {result.soundEffects.missing.length ? (
                  <p className="mt-1 break-words font-mono text-foreground/70">
                    {result.soundEffects.missing.join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-foreground/55">
              {ui("Checked")}{" "}
              {new Date(result.checkedAt).toLocaleString(getUiLocale())}
              {ui(". Generation not tested.")}
            </p>
          </>
        ) : null}
      </div>
    </article>
  );
}
