import { Range } from "./mockData";
import { cn } from "@/lib/utils";

const OPTIONS: { id: Range; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

export function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface/40 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            value === o.id
              ? "bg-card text-foreground shadow-sm"
              : "text-foreground/55 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
