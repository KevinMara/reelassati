import { useEffect, useState } from "react";
import { Send, Calendar, Clock, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { PlatformPicker } from "@/components/publisher/PlatformPicker";
import { CaptionEditor } from "@/components/publisher/CaptionEditor";
import { ScheduleHeatmap } from "@/components/publisher/ScheduleHeatmap";
import { CAPTIONS, MOCK_REEL, PLATFORMS, Platform, CaptionVariant } from "@/components/publisher/mockData";
import { toast } from "@/hooks/use-toast";
import { useAgentJob } from "@/hooks/useAgentJob";

type Step = "compose" | "schedule" | "review" | "publishing" | "done";

export default function PublishRoute() {
  return <AppShell renderWith={() => <PublishPage />} />;
}

function PublishPage() {
  const [step, setStep] = useState<Step>("compose");
  const [selected, setSelected] = useState<Platform[]>(["instagram", "tiktok"]);
  const [captions, setCaptions] = useState<CaptionVariant[]>(CAPTIONS);
  const [activeTab, setActiveTab] = useState<Platform>("instagram");
  const [slots, setSlots] = useState<Record<Platform, { day: string; hour: number } | null>>({
    instagram: { day: "Tue", hour: 19 },
    tiktok: { day: "Wed", hour: 21 },
    youtube: null,
    facebook: null,
    linkedin: null,
  });
  const [mode, setMode] = useState<"now" | "schedule" | "best">("schedule");
  const { job, start } = useAgentJob("publisher");

  useEffect(() => {
    if (job?.status === "completed") setStep("done");
    if (job?.status === "failed") setStep("review");
  }, [job?.status]);

  async function handlePublish() {
    setStep("publishing");
    const scheduled_at =
      mode === "now"
        ? new Date().toISOString()
        : mode === "best"
          ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    try {
      await start({
        jobType: "schedule_posts",
        payload: {
          platforms: selected,
          scheduled_at,
          mode,
          captions: captions.filter((c) => selected.includes(c.platform)),
        },
      });
    } catch {
      setStep("review");
    }
  }

  function togglePlatform(p: Platform) {
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
    if (!selected.includes(p)) setActiveTab(p);
  }

  const activeCaption = captions.find((c) => c.platform === activeTab) ?? captions[0];

  function updateCaption(c: CaptionVariant) {
    setCaptions((arr) => arr.map((x) => (x.id === c.id ? c : x)));
  }

  return (
    <section className="container-page py-8 lg:py-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Send className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Publisher</h1>
          <p className="text-sm text-foreground/55 mt-0.5">
            One reel. Five platforms. Each with its own voice and timing.
          </p>
        </div>
      </header>

      <Stepper step={step} />

      {(step === "compose" || step === "schedule" || step === "review") && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-6">
          {/* main column */}
          <div className="space-y-6">
            {step === "compose" && (
              <>
                <Section title="1 — Pick destinations" subtitle="Each platform gets its own caption + tags + slot.">
                  <PlatformPicker selected={selected} onToggle={togglePlatform} />
                </Section>

                <Section title="2 — Tune each caption" subtitle="Switch tabs to edit per-platform.">
                  <PlatformTabs active={activeTab} onChange={setActiveTab} platforms={selected} />
                  {selected.length > 0 ? (
                    <CaptionEditor
                      platform={activeTab}
                      caption={activeCaption}
                      onChange={updateCaption}
                      onRegenerate={() => toast({ title: "Caption regenerated", description: `New variant for ${PLATFORMS.find(p => p.id === activeTab)?.name}` })}
                    />
                  ) : (
                    <p className="text-sm text-foreground/50 py-6 text-center">Pick at least one platform above.</p>
                  )}
                </Section>
              </>
            )}

            {step === "schedule" && (
              <Section title="3 — When to drop" subtitle="Heatmap shows your audience's last 90 days.">
                <ModeSwitch mode={mode} setMode={setMode} />
                {mode === "schedule" && selected.length > 0 && (
                  <div className="space-y-6 mt-4">
                    <PlatformTabs active={activeTab} onChange={setActiveTab} platforms={selected} />
                    <ScheduleHeatmap
                      platform={activeTab}
                      selectedSlot={slots[activeTab]}
                      onSelect={(s) => setSlots((prev) => ({ ...prev, [activeTab]: s }))}
                    />
                  </div>
                )}
                {mode === "best" && (
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                    <div className="font-medium text-primary mb-1">Auto-best per platform</div>
                    <p className="text-foreground/70 leading-relaxed">
                      Each platform fires at its own predicted peak. We'll never bunch posts within 30 min of each other.
                    </p>
                  </div>
                )}
                {mode === "now" && (
                  <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                    <div className="font-medium text-amber-600 dark:text-amber-400 mb-1">Publish immediately</div>
                    <p className="text-foreground/70">Skips peak-time analysis. Use only when timing matters more than reach.</p>
                  </div>
                )}
              </Section>
            )}

            {step === "review" && (
              <Section title="4 — Final review" subtitle="Confirm everything before launch.">
                <div className="space-y-3">
                  {selected.map((p) => {
                    const meta = PLATFORMS.find((x) => x.id === p)!;
                    const cap = captions.find((c) => c.platform === p)!;
                    const slot = slots[p];
                    return (
                      <div key={p} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
                        <span className="h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold text-white"
                          style={{ background: `hsl(${meta.color})` }}>
                          {meta.name[0]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-semibold">{meta.name} · {meta.handle}</div>
                            <div className="text-xs text-foreground/55 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {mode === "now" ? "Now" : mode === "best" ? `Auto: ${meta.bestSlots[0]}` : slot ? `${slot.day} ${slot.hour}:00` : "—"}
                            </div>
                          </div>
                          <p className="text-xs text-foreground/65 line-clamp-2 leading-relaxed">{cap.text}</p>
                          <div className="text-[10px] text-foreground/45 mt-1">
                            {cap.hashtags.length} tags · {cap.text.length + cap.hashtags.join(" ").length + 1} chars
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* nav */}
            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (step === "compose") return;
                  setStep(step === "schedule" ? "compose" : "schedule");
                }}
                disabled={step === "compose"}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step !== "review" ? (
                <Button
                  variant="primary"
                  size="lg"
                  disabled={selected.length === 0}
                  onClick={() => setStep(step === "compose" ? "schedule" : "review")}
                >
                  Continue
                </Button>
              ) : (
                <Button variant="primary" size="lg" onClick={handlePublish}>
                  <Send className="h-4 w-4" /> Publish to {selected.length}
                </Button>
              )}
            </div>
          </div>

          {/* sticky preview */}
          <aside className="lg:sticky lg:top-6 self-start">
            <ReelPreview activeCaption={activeCaption} platforms={selected} />
          </aside>
        </div>
      )}

      {step === "publishing" && <PublishingStage count={selected.length} />}
      {step === "done" && <DoneStage selected={selected} onAnother={() => setStep("compose")} />}
    </section>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = ["compose", "schedule", "review"] as const;
  const idx = step === "publishing" || step === "done" ? 3 : steps.indexOf(step as typeof steps[number]);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            i <= idx ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground/50"
          }`}>
            {i < idx || step === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={`text-xs font-medium uppercase tracking-wider ${i <= idx ? "text-foreground" : "text-foreground/40"}`}>
            {s}
          </span>
          {i < steps.length - 1 && <div className={`h-px w-8 ${i < idx ? "bg-primary" : "bg-foreground/15"}`} />}
        </div>
      ))}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-foreground/55 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PlatformTabs({ active, onChange, platforms }: { active: Platform; onChange: (p: Platform) => void; platforms: Platform[] }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {platforms.map((p) => {
        const meta = PLATFORMS.find((x) => x.id === p)!;
        const on = active === p;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`relative px-3 py-2 text-xs font-medium transition-colors ${on ? "text-foreground" : "text-foreground/50 hover:text-foreground/80"}`}
          >
            {meta.name}
            {on && <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-t" style={{ background: `hsl(${meta.color})` }} />}
          </button>
        );
      })}
    </div>
  );
}

function ModeSwitch({ mode, setMode }: { mode: "now" | "schedule" | "best"; setMode: (m: "now" | "schedule" | "best") => void }) {
  const opts: { id: "now" | "schedule" | "best"; label: string; sub: string }[] = [
    { id: "best", label: "Auto-best", sub: "AI picks per platform" },
    { id: "schedule", label: "Pick a slot", sub: "Manual heatmap" },
    { id: "now", label: "Now", sub: "Instant publish" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => setMode(o.id)}
          className={`rounded-lg border p-3 text-left transition-all ${
            mode === o.id ? "border-primary bg-primary/5" : "border-border bg-surface/40 hover:border-foreground/20"
          }`}
        >
          <div className="text-sm font-semibold">{o.label}</div>
          <div className="text-[11px] text-foreground/55 mt-0.5">{o.sub}</div>
        </button>
      ))}
    </div>
  );
}

function ReelPreview({ activeCaption, platforms }: { activeCaption: CaptionVariant; platforms: Platform[] }) {
  const meta = PLATFORMS.find((p) => p.id === activeCaption.platform)!;
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-foreground/45 font-medium flex items-center justify-between">
        <span>Preview · {meta.name}</span>
        <span>{platforms.length} dest.</span>
      </div>
      <div className="relative aspect-[9/16] w-full max-w-[200px] mx-auto rounded-xl overflow-hidden"
        style={{ background: `linear-gradient(160deg, hsl(${MOCK_REEL.hue} 60% 25%), hsl(${MOCK_REEL.hue} 80% 14%))` }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-6xl">{MOCK_REEL.thumb}</div>
        <div className="absolute bottom-2 left-2 right-2 text-white text-[10px] line-clamp-3 drop-shadow-lg leading-tight">
          {activeCaption.text}
        </div>
        <div className="absolute top-2 left-2 text-[9px] text-white/80 font-mono">{MOCK_REEL.duration}s</div>
      </div>
      <div className="text-[10px] text-foreground/55 text-center">{MOCK_REEL.title}</div>
    </div>
  );
}

function PublishingStage({ count }: { count: number }) {
  return (
    <div className="max-w-md mx-auto py-20 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-primary/10 text-primary items-center justify-center mb-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Pushing to {count} platforms…</h2>
      <p className="text-sm text-foreground/55">Encoding · uploading · scheduling. You can close this tab.</p>
    </div>
  );
}

function DoneStage({ selected, onAnother }: { selected: Platform[]; onAnother: () => void }) {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-primary/10 text-primary items-center justify-center mb-6">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Scheduled.</h2>
      <p className="text-sm text-foreground/60 mb-8">
        {selected.length} posts queued. We'll notify you when each goes live and ping you with a 24h performance digest.
      </p>
      <div className="flex justify-center gap-2">
        <Button variant="ghost" onClick={onAnother}>Publish another</Button>
        <Button variant="primary" onClick={() => (window.location.href = "/dashboard/calendar")}>
          <Calendar className="h-4 w-4" /> View calendar
        </Button>
      </div>
    </div>
  );
}
