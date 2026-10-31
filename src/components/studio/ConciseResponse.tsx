import { useState } from "react";
import { useUiText } from "@/lib/i18n/ui";

/** The full response remains available without making the conversation a report. */
export function ConciseResponse({
  text,
  detailsText,
  limit = 240,
}: {
  text: string;
  detailsText?: string;
  limit?: number;
}) {
  const ui = useUiText();
  text = text.replace(/\banalysis credits\b/gi, "credits");
  detailsText = detailsText?.replace(/\banalysis credits\b/gi, "credits");
  const [expanded, setExpanded] = useState(false);
  const long = text.length > limit;
  const hasDetails = Boolean(detailsText?.trim() && detailsText !== text);
  const cutoff = text.lastIndexOf(" ", limit);
  return (
    <div className="text-[13px] leading-relaxed">
      <p className="whitespace-pre-wrap break-words">
        {long && !expanded
          ? `${text.slice(0, cutoff > limit / 2 ? cutoff : limit).trimEnd()}…`
          : text}
      </p>
      {hasDetails && expanded && (
        <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
          {detailsText}
        </p>
      )}
      {(long || hasDetails) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {ui(expanded ? "Show less" : "Show details")}
        </button>
      )}
    </div>
  );
}
