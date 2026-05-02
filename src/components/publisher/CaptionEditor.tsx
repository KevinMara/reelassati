import { useMemo } from "react";
import { Hash, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Platform, PLATFORMS, CaptionVariant } from "./mockData";

export function CaptionEditor({
  platform,
  caption,
  onChange,
  onRegenerate,
}: {
  platform: Platform;
  caption: CaptionVariant;
  onChange: (c: CaptionVariant) => void;
  onRegenerate: () => void;
}) {
  const meta = PLATFORMS.find((p) => p.id === platform)!;
  const totalChars = caption.text.length + caption.hashtags.join(" ").length + 1;
  const overLimit = totalChars > meta.charLimit;
  const tagCount = caption.hashtags.length;
  const inSweet = tagCount >= meta.hashtagSweet[0] && tagCount <= meta.hashtagSweet[1];

  const tagWarning = useMemo(() => {
    if (tagCount < meta.hashtagSweet[0]) return `Add ${meta.hashtagSweet[0] - tagCount} more for ${meta.name}'s sweet spot.`;
    if (tagCount > meta.hashtagSweet[1]) return `Drop ${tagCount - meta.hashtagSweet[1]} — too many for ${meta.name}.`;
    return null;
  }, [tagCount, meta]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${meta.color})` }} />
          <span className="text-sm font-semibold">{meta.name}</span>
          <span className="text-xs text-foreground/50">· {meta.handle}</span>
        </div>
        <div className="flex items-center gap-3">
          <PredictedReach value={caption.predictedReach} color={meta.color} />
          <Button variant="ghost" size="sm" onClick={onRegenerate}>
            <Sparkles className="h-3.5 w-3.5" /> Regenerate
          </Button>
        </div>
      </div>

      <textarea
        value={caption.text}
        onChange={(e) => onChange({ ...caption, text: e.target.value })}
        rows={4}
        className="w-full rounded-lg border border-input bg-surface/40 px-3 py-2.5 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-foreground/45 font-medium">
          <Hash className="h-3 w-3" /> Hashtags
        </div>
        <div className="flex flex-wrap gap-1.5">
          {caption.hashtags.map((h, i) => (
            <button
              key={i}
              onClick={() => onChange({ ...caption, hashtags: caption.hashtags.filter((_, j) => j !== i) })}
              className="text-xs px-2 py-1 rounded-md bg-surface border border-border text-foreground/75 hover:border-destructive/40 hover:text-destructive transition-colors"
            >
              {h} ×
            </button>
          ))}
          <button
            onClick={() => {
              const tag = window.prompt("Add hashtag (without #)");
              if (tag) onChange({ ...caption, hashtags: [...caption.hashtags, `#${tag.replace(/^#/, "")}`] });
            }}
            className="text-xs px-2 py-1 rounded-md border border-dashed border-border text-foreground/55 hover:text-foreground hover:border-foreground/40"
          >
            + add
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
        <div className={overLimit ? "text-destructive" : "text-foreground/55"}>
          {totalChars.toLocaleString()} / {meta.charLimit.toLocaleString()} chars
        </div>
        <div className={inSweet ? "text-foreground/55" : "text-amber-600 dark:text-amber-400 flex items-center gap-1"}>
          {!inSweet && <AlertTriangle className="h-3 w-3" />}
          {tagWarning ?? `${tagCount} tags · in sweet spot`}
        </div>
      </div>
    </div>
  );
}

function PredictedReach({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10px] uppercase tracking-wider text-foreground/45">Reach</div>
      <div className="relative h-1.5 w-20 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${value}%`, background: `hsl(${color})` }}
        />
      </div>
      <div className="text-xs tabular-nums font-semibold">{value}</div>
    </div>
  );
}
