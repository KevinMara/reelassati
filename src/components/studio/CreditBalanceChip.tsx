import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Coins } from "lucide-react";
import { useUiText } from "@/lib/i18n/ui";
import { platformApi } from "@/lib/platform-api";

export function CreditBalanceChip({ refreshKey }: { refreshKey: string }) {
  const ui = useUiText();
  const { i18n } = useTranslation();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void platformApi
        .billingSummary()
        .then(result => {
          if (active) setCredits(result.billing.availableCredits);
        })
        .catch(() => {
          if (active) setCredits(null);
        });
    };
    refresh();
    window.addEventListener("reelassati:credits-changed", refresh);
    return () => {
      window.removeEventListener("reelassati:credits-changed", refresh);
      active = false;
    };
  }, [refreshKey]);

  return (
    <Link
      to="/dashboard/billing"
      aria-label={
        credits === null
          ? ui("Open plan and credits")
          : ui("Available credits: {{credits}}", {
              credits: credits.toLocaleString(i18n.resolvedLanguage),
            })
      }
      className="group hidden items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs transition-all hover:border-primary/35 hover:shadow-sm sm:flex"
    >
      <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Coins className="h-3 w-3" />
      </span>
      <span className="font-mono font-medium">
        {credits === null
          ? ui("Credits")
          : credits.toLocaleString(i18n.resolvedLanguage)}
      </span>
    </Link>
  );
}
