import { Check } from "lucide-react";
import { Platform, PLATFORMS } from "./mockData";
import { cn } from "@/lib/utils";

export function PlatformPicker({
  selected,
  onToggle,
}: {
  selected: Platform[];
  onToggle: (p: Platform) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {PLATFORMS.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            key={p.id}
            onClick={() => onToggle(p.id)}
            className={cn(
              "relative rounded-xl border px-3 py-3 text-left transition-all",
              on
                ? "border-transparent bg-card shadow-card ring-2"
                : "border-border bg-surface/40 hover:border-foreground/20",
            )}
            style={on ? { boxShadow: `0 0 0 2px hsl(${p.color} / 0.5)` } : undefined}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: `hsl(${p.color})` }}
                />
                <span className="text-sm font-medium">{p.name}</span>
              </div>
              {on && <Check className="h-3.5 w-3.5 text-foreground/60" />}
            </div>
            <div className="text-[11px] text-foreground/50 mt-1 truncate">{p.handle}</div>
          </button>
        );
      })}
    </div>
  );
}
