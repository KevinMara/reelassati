import { useState } from "react";
import { useUiText } from "@/lib/i18n/ui";

/** The full response remains available without making the conversation a report. */
export function ConciseResponse({
  text,
  limit = 240,
}: {
  text: string;
  limit?: number;
}) {
  const ui = useUiText();
  const [expanded, setExpanded] = useState(false);
  const long = text.length > limit;
  const cutoff = text.lastIndexOf(" ", limit);
  return (
    <div className="text-[13px] leading-relaxed">
      <p className="whitespace-pre-wrap break-words">
        {long && !expanded
          ? `${text.slice(0, cutoff > limit / 2 ? cutoff : limit).trimEnd()}…`
          : text}
      </p>
      {long && (
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
