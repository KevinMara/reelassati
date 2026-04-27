import { useTranslation } from "react-i18next";
import { Check, Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function LangSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.split("-")[0] || "it";
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === current) ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-2 h-9 px-3 rounded-pill text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background text-sm",
          className,
        )}
        aria-label={t("lang.label")}
      >
        <Globe className="h-4 w-4" />
        {!compact && <span className="font-mono text-xs uppercase tracking-wider">{currentLang.code}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-lg border-border-strong shadow-cutout">
        <DropdownMenuLabel className="mono-eyebrow text-foreground/50">
          {t("lang.label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((lang) => {
          const pending = "pending" in lang && lang.pending;
          return (
            <DropdownMenuItem
              key={lang.code}
              disabled={pending}
              onSelect={() => !pending && i18n.changeLanguage(lang.code)}
              className="flex items-center justify-between gap-2 cursor-pointer rounded-md py-2"
            >
              <span className="flex items-center gap-3">
                <span className="text-base leading-none">{lang.flag}</span>
                <span>{lang.label}</span>
              </span>
              {pending ? (
                <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
                  {t("lang.pending")}
                </span>
              ) : current === lang.code ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
