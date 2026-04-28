import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface UsageMeterProps {
  used: number;
  allocated: number;
  unlimited?: boolean;
  compact?: boolean;
  className?: string;
}

export function UsageMeter({ used, allocated, unlimited, compact, className }: UsageMeterProps) {
  const { t } = useTranslation();
  if (unlimited) return null;
  const pct = Math.min(100, allocated > 0 ? (used / allocated) * 100 : 0);
  const over = pct >= 90;

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("flex items-baseline justify-between", compact ? "text-[11px]" : "text-xs")}>
        <span className="text-foreground/60 tabular-nums">
          {t("app.usage.label")}
        </span>
        <span className="font-medium tabular-nums">
          €{used.toFixed(2)} / €{allocated.toFixed(0)}
        </span>
      </div>
      <div className={cn("mt-1.5 h-1 w-full rounded-full bg-foreground/[0.08] overflow-hidden")}>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            over ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
