import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 flex flex-col gap-3 transition-[box-shadow,border-color] duration-200 hover:shadow-md",
        accent && "border-primary/30",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="mono-eyebrow text-foreground/50">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-foreground/40" />}
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="text-xs text-foreground/50">{hint}</div>}
      {children}
    </div>
  );
}
