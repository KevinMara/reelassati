import { useState } from "react";
import { Image as ImageIcon, Sparkles, Info, RefreshCw, Upload, Film, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Platform } from "./mockData";

const SUPPORTS_THUMB: Platform[] = ["youtube", "tiktok", "instagram", "linkedin"];

export type ThumbnailCandidate = {
  index: number;
  storage_key: string;
  image_url: string;
  concept: string;
  uses_text_overlay?: boolean;
  text_overlay_content?: string | null;
  engagement_signals?: string[];
  predicted_engagement_score?: number;
};

type Props = {
  platforms: Platform[];
  activePlatform: Platform;
  title: string;
  draftId?: string;
  candidates: ThumbnailCandidate[];
  selectedIndex: number | null;
  onCandidates: (c: ThumbnailCandidate[], generationId: string) => void;
  onSelect: (i: number) => void;
};

const STAGES = [
  { key: "tribe", label: "Analyzing engagement signals…" },
  { key: "concept", label: "Generating concept…" },
  { key: "prompt", label: "Crafting prompts…" },
  { key: "image", label: "Generating images… (~20s)" },
];

export function ThumbnailSection({
  platforms, activePlatform, title, draftId, candidates, selectedIndex, onCandidates, onSelect,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [quality, setQuality] = useState<"medium" | "high">("medium");
  const [costOpen, setCostOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenId, setLastGenId] = useState<string | null>(null);

  const visiblePlatforms = platforms.filter((p) => SUPPORTS_THUMB.includes(p));
  if (visiblePlatforms.length === 0) return null;

  const requiredFor = visiblePlatforms.includes("youtube");
  const cost = quality === "high" ? 0.65 : 0.20;

  async function generate(refinementOf?: string, instruction?: string) {
    setError(null);
    setLoading(true);
    setStage(0);
    // animate stage progression
    const t1 = setTimeout(() => setStage(1), 1200);
    const t2 = setTimeout(() => setStage(2), 3000);
    const t3 = setTimeout(() => setStage(3), 5000);
    try {
      if (!title.trim()) throw new Error("Pick a title first — it shapes the thumbnail.");
      const { data, error } = await supabase.functions.invoke("generate-thumbnail", {
        body: {
          draft_id: draftId,
          platform: activePlatform,
          title,
          quality,
          refinement_of: refinementOf,
          refinement_instruction: instruction,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message ?? data.error);
      onCandidates(data.candidates, data.generation_id);
      setLastGenId(data.generation_id);
      toast({ title: "Thumbnails ready", description: `3 candidates · €${data.total_cost_eur.toFixed(2)}` });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      [t1, t2, t3].forEach(clearTimeout);
      setLoading(false);
      setStage(0);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Thumbnail</h3>
          {requiredFor && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
              Required for YouTube
            </span>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-foreground/40 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[240px]">
                AI-generated thumbnail engineered for high engagement using neural prediction (TRIBE v2 → Opus 4.7 → GPT Image 2).
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {candidates.length > 0 && (
          <div className="text-[10px] text-foreground/45">{visiblePlatforms.length} platform{visiblePlatforms.length === 1 ? "" : "s"}</div>
        )}
      </header>

      {/* EMPTY STATE */}
      {candidates.length === 0 && !loading && (
        <div className="space-y-3">
          <div className="aspect-[9/16] w-[160px] mx-auto rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-surface/30">
            <ImageIcon className="h-6 w-6 text-foreground/30" />
            <p className="text-[11px] text-foreground/45">Generate thumbnail</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="sm" onClick={() => setCostOpen(true)} className="w-full">
              <Sparkles className="h-3.5 w-3.5" /> Generate 3 thumbnails
            </Button>
            <button
              className="text-[11px] text-foreground/55 hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => toast({ title: "Coming soon", description: "Video frame extraction lands with the analyzer integration." })}
            >
              Use frame from video instead (free)
            </button>
          </div>
        </div>
      )}

      {/* LOADING */}
      {loading && <LoadingStages stage={stage} />}

      {/* RESULTS */}
      {candidates.length > 0 && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {candidates.map((c) => (
              <CandidateCard
                key={c.index}
                cand={c}
                selected={selectedIndex === c.index}
                onClick={() => onSelect(c.index)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRefineOpen(true)} disabled={selectedIndex === null}>
              <Sparkles className="h-3.5 w-3.5" /> Refine
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCostOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast({ title: "Upload", description: "Custom upload coming next." })}>
              <Upload className="h-3.5 w-3.5" /> Upload custom
            </Button>
            <button
              className="text-[11px] text-foreground/55 hover:text-foreground self-center ml-auto"
              onClick={() => toast({ title: "Coming soon" })}
            >
              <Film className="h-3 w-3 inline mr-1" /> Use video frame
            </button>
          </div>

          {selectedIndex !== null && (
            <PlatformCropPreview platforms={visiblePlatforms} activePlatform={activePlatform} />
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
          <div>
            <div className="font-medium text-destructive">Generation failed</div>
            <p className="text-foreground/70 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* COST CONFIRM */}
      <Dialog open={costOpen} onOpenChange={setCostOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate 3 thumbnails</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-foreground/70">
              Runs the 3-stage pipeline: engagement analysis → concept → image generation.
            </p>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-foreground/50 font-medium">Image quality</div>
              <div className="grid grid-cols-2 gap-2">
                {(["medium", "high"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`rounded-md border p-2 text-left transition-all ${
                      quality === q ? "border-primary bg-primary/5" : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <div className="text-xs font-semibold capitalize">{q}</div>
                    <div className="text-[10px] text-foreground/55">€{q === "high" ? "0.65" : "0.20"}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-foreground/55">
              Total estimated cost: <span className="font-semibold text-foreground">€{cost.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setCostOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => { setCostOpen(false); generate(); }}>
              Generate · €{cost.toFixed(2)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* REFINE */}
      <RefineModal
        open={refineOpen}
        onClose={() => setRefineOpen(false)}
        onSubmit={(instruction) => {
          setRefineOpen(false);
          generate(lastGenId ?? undefined, instruction);
        }}
      />
    </div>
  );
}

function CandidateCard({ cand, selected, onClick }: { cand: ThumbnailCandidate; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
        selected ? "border-primary scale-[1.02] shadow-lg" : "border-border hover:border-foreground/20"
      }`}
    >
      <div className="aspect-[9/16] bg-surface/40">
        {cand.image_url ? (
          <img src={cand.image_url} alt={cand.concept} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-foreground/30">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        {selected && (
          <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
            <Check className="h-3 w-3" />
          </div>
        )}
        {(cand.predicted_engagement_score ?? 0) >= 0.8 && (
          <div className="absolute top-1.5 left-1.5 text-[8px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
            High attention
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 bg-card">
        <div className="text-[10px] font-medium truncate">{cand.concept}</div>
      </div>
    </button>
  );
}

function LoadingStages({ stage }: { stage: number }) {
  return (
    <div className="py-6 space-y-3">
      <div className="aspect-[9/16] w-[160px] mx-auto rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 animate-pulse bg-primary/5" />
        <Loader2 className="h-6 w-6 text-primary animate-spin relative" />
      </div>
      <ul className="space-y-1.5 max-w-xs mx-auto">
        {STAGES.map((s, i) => {
          const state = i < stage ? "done" : i === stage ? "active" : "pending";
          return (
            <li key={s.key} className="flex items-center gap-2 text-[11px]">
              <span className={`h-1.5 w-1.5 rounded-full ${
                state === "done" ? "bg-primary" : state === "active" ? "bg-primary animate-pulse" : "bg-foreground/15"
              }`} />
              <span className={state === "pending" ? "text-foreground/40" : "text-foreground/80"}>{s.label}</span>
              {state === "done" && <Check className="h-3 w-3 text-primary ml-auto" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const QUICK_REFINE = ["More color contrast", "Bigger face", "Add text overlay", "Different mood", "More minimal", "Closer composition"];

function RefineModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (s: string) => void }) {
  const [v, setV] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refine thumbnail</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="What should change?" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REFINE.map((q) => (
              <button
                key={q}
                onClick={() => setV(q)}
                className="text-[11px] px-2 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-foreground/50">
            Skips engagement analysis (cached). Costs €0.20 medium / €0.65 high.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!v.trim()} onClick={() => onSubmit(v.trim())}>
            Refine
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PLATFORM_CROPS: Record<string, { label: string; size: string }> = {
  youtube: { label: "YT", size: "1280×720" },
  tiktok: { label: "TT", size: "1080×1920" },
  instagram: { label: "IG", size: "1080×1920" },
  linkedin: { label: "LI", size: "1200×675" },
};

function PlatformCropPreview({ platforms, activePlatform }: { platforms: Platform[]; activePlatform: Platform }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-foreground/55 pt-2 border-t border-border">
      <span className="uppercase tracking-wider font-medium">Cropped for:</span>
      {platforms.map((p) => {
        const meta = PLATFORM_CROPS[p];
        if (!meta) return null;
        return (
          <span
            key={p}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
              p === activePlatform ? "bg-primary/10 text-primary font-medium" : "bg-foreground/5"
            }`}
          >
            <Check className="h-2.5 w-2.5" />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
