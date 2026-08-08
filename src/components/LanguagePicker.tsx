import { Globe2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  selectLanguage,
  supportedLanguages,
  type SupportedLanguage,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || "en").split(
    "-"
  )[0] as SupportedLanguage;

  return (
    <label
      className={cn(
        "relative inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground",
        compact ? "text-xs" : "text-sm"
      )}
    >
      <Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={current}
        onChange={event =>
          void selectLanguage(event.target.value as SupportedLanguage)
        }
        className="max-w-[8.5rem] cursor-pointer appearance-none bg-transparent pe-3 text-current outline-none"
        aria-label="Language"
      >
        {supportedLanguages.map(([code, label]) => (
          <option
            key={code}
            value={code}
            className="bg-background text-foreground"
          >
            {label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-0 text-[8px]">▾</span>
    </label>
  );
}
