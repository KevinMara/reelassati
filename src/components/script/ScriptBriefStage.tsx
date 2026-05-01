import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TONE_PRESETS, FORMAT_PRESETS, PLATFORM_PRESETS } from "./mockData";
import { cn } from "@/lib/utils";

export type ScriptBrief = {
  goal: string;
  angle: string;
  duration: number;
  tone: string[];
  format: string;
  platforms: string[];
  client: string;
  references: string;
};

export function ScriptBriefStage({
  onGenerate,
}: {
  onGenerate: (brief: ScriptBrief) => void;
}) {
  const [angle, setAngle] = useState("");
  const [goal, setGoal] = useState("virality");
  const [duration, setDuration] = useState(20);
  const [tone, setTone] = useState<string[]>(["Calm authority"]);
  const [format, setFormat] = useState("Voice-over");
  const [platforms, setPlatforms] = useState<string[]>(["Reels"]);
  const [refs, setRefs] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const ready = angle.trim().length > 6;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Big idea */}
      <div className="rounded-2xl border border-border bg-card p-6 lg:p-8">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary/80 mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          The idea
        </div>
        <textarea
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder="Describe what this video should be about. One sentence is enough — the agent will fill in the rest."
          rows={3}
          className="w-full bg-transparent border-0 focus:outline-none text-2xl lg:text-3xl leading-snug font-medium text-foreground placeholder:text-foreground/25 resize-none"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "Show why our 72-hour dough matters",
            "Behind-the-scenes morning prep",
            "Customer reaction to the new menu",
          ].map((s) => (
            <button
              key={s}
              onClick={() => setAngle(s)}
              className="text-xs px-3 py-1.5 rounded-pill border border-border text-foreground/55 hover:text-primary hover:border-primary/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Quick controls row */}
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Goal">
          <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full h-10 rounded-md bg-surface border border-input px-3 text-sm">
            <option value="virality">Virality</option>
            <option value="conversion">Conversion</option>
            <option value="brand_awareness">Brand awareness</option>
            <option value="education">Education</option>
            <option value="entertainment">Entertainment</option>
          </select>
        </Field>
        <Field label="Duration">
          <div className="flex items-center gap-3 h-10">
            <input
              type="range"
              min={8}
              max={60}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-sm tabular-nums w-12 text-right text-foreground/70">{duration}s</span>
          </div>
        </Field>
        <Field label="Format">
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full h-10 rounded-md bg-surface border border-input px-3 text-sm">
            {FORMAT_PRESETS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
      </div>

      {/* Tone chips */}
      <div>
        <Label>Tone</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {TONE_PRESETS.map((t) => (
            <button
              key={t}
              onClick={() => toggle(tone, t, setTone)}
              className={cn(
                "px-3 py-1.5 rounded-pill text-sm border transition-all",
                tone.includes(t)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-foreground/65 hover:border-foreground/30",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Platforms */}
      <div>
        <Label>Target platforms</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {PLATFORM_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => toggle(platforms, p, setPlatforms)}
              className={cn(
                "px-3 py-1.5 rounded-pill text-sm border transition-all",
                platforms.includes(p)
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-foreground/65 hover:border-foreground/30",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced */}
      <div className="rounded-xl border border-border">
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground/70 hover:text-foreground"
        >
          <span>Advanced — references & constraints</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
        </button>
        {advancedOpen && (
          <div className="px-4 pb-4 space-y-3">
            <Field label="Reference videos / inspiration (URLs or notes)">
              <textarea
                value={refs}
                onChange={(e) => setRefs(e.target.value)}
                rows={3}
                placeholder="Drop links from the library, or describe a video you want this to feel like."
                className="w-full bg-surface border border-input rounded-md px-3 py-2 text-sm"
              />
            </Field>
            <p className="text-xs text-foreground/45">
              The agent reads the active client's brief automatically (banned phrases, tone exceptions, signature hashtags).
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="primary" size="lg" disabled={!ready} onClick={() => onGenerate({ goal, angle, duration, tone, format, platforms, client: "default", references: refs })}>
          <Sparkles className="h-4 w-4" />
          Generate 3 variants
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] uppercase tracking-wider text-foreground/55 font-medium">{children}</label>;
}
