import { useUiText } from "@/lib/i18n/ui";
import { useTranslation } from "react-i18next";
import { Bot, CheckCircle2 } from "lucide-react";
import type { ContentProvenance } from "@contracts/compliance";

const ORIGIN_LABELS: Record<ContentProvenance["origin"], string> = {
  human: "Human-created",
  uploaded: "Uploaded source",
  "ai-assisted": "AI-assisted",
  "ai-generated": "AI-generated",
  "ai-manipulated": "AI-manipulated",
  "standard-edit": "Standard edit",
};

const OPERATION_LABELS: Record<ContentProvenance["operation"], string> = {
  "script-generation": "Script",
  "edit-planning": "Edit plan",
  "video-analysis": "Video analysis",
  transcription: "Transcription",
  "speech-synthesis": "Voice",
  "audio-generation": "Music & sound effects",
  "image-generation": "Image",
  "video-generation": "Video",
  "trend-research": "Trend research",
  "support-assistance": "Support",
  "publication-marking": "Publishing",
  "timeline-render": "Export",
};

const MARK_LABELS: Record<ContentProvenance["marking"]["status"], string> = {
  "not-required": "Not required",
  pending: "Pending",
  verified: "Verified",
  failed: "Failed",
};

/** EU-AI-05 — Compact output-level origin that survives across Studio surfaces. */
export function AiProvenanceBadge({
  provenance,
  compact = false,
}: {
  provenance?: ContentProvenance;
  compact?: boolean;
}) {
  const ui = useUiText();
  const { i18n } = useTranslation("ui");
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  if (!provenance) return null;
  const label = ui(ORIGIN_LABELS[provenance.origin]);
  return (
    <details className="group relative inline-block">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary marker:hidden"
        aria-label={ui("{{origin}}. Open origin details", { origin: label })}
      >
        <Bot className="h-3 w-3" aria-hidden />
        {label}
        {!compact && provenance.marking.status === "verified" ? (
          <CheckCircle2
            className="h-3 w-3 text-emerald-500"
            aria-label={ui("Provenance record sealed")}
          />
        ) : null}
      </summary>
      <div className="absolute left-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-4 text-left shadow-xl sm:left-auto sm:right-0">
        <p className="text-xs font-semibold">{ui("Origin details")}</p>
        <dl className="mt-3 grid grid-cols-[78px_1fr] gap-x-3 gap-y-2 text-[11px]">
          <dt className="text-foreground/40">{ui("Workflow")}</dt>
          <dd>{ui(OPERATION_LABELS[provenance.operation])}</dd>
          <dt className="text-foreground/40">{ui("System")}</dt>
          <dd>REELassati AI</dd>
          <dt className="text-foreground/40">{ui("Created")}</dt>
          <dd>{new Date(provenance.generatedAt).toLocaleString(locale)}</dd>
          <dt className="text-foreground/40">{ui("Mark")}</dt>
          <dd>{ui(MARK_LABELS[provenance.marking.status])}</dd>
        </dl>
        {provenance.marking.publicToken ? (
          <a
            href={`/#/provenance?token=${encodeURIComponent(provenance.marking.publicToken)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
          >
            {ui("Inspect record")}
          </a>
        ) : null}
      </div>
    </details>
  );
}
