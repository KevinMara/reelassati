import { useState, useCallback, useEffect, useLayoutEffect } from "react";
import {
  BarChart3,
  Bell,
  Film,
  Library,
  Play,
  Scissors,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import EntryAnimation from "@/components/entry/EntryAnimation";
import { Logo } from "@/components/Logo";

function StudioUnderlay() {
  const nav = [
    { label: "Dashboard", icon: BarChart3 },
    { label: "AI Video", icon: Film },
    { label: "Editing Studio", icon: Scissors, active: true },
    { label: "Library", icon: Library },
    { label: "Settings", icon: Settings },
  ];

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-background text-foreground">
      <aside className="hidden h-full w-56 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Logo />
        </div>
        <div className="space-y-1 p-3">
          {nav.map(({ label, icon: Icon, active }) => (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground/55"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-background/90 px-6">
          <span className="mono-eyebrow text-foreground/45">Editing Studio</span>
          <div className="flex-1" />
          <Search className="mr-5 h-4 w-4 text-foreground/40" />
          <Bell className="h-4 w-4 text-foreground/40" />
        </header>

        <main className="flex-1 p-6 lg:p-10">
          <div className="mx-auto max-w-6xl">
            <p className="mono-eyebrow mb-2 text-primary">Precision Studio</p>
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-semibold md:text-4xl">
                  Shape the next cut.
                </h1>
                <p className="mt-2 text-sm text-foreground/50">
                  A reviewable short-form timeline, ready for your footage.
                </p>
              </div>
              <button className="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:flex">
                <Sparkles className="h-4 w-4" />
                Assist this cut
              </button>
            </div>

            <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
              <div className="flex h-12 items-center border-b border-border px-5">
                <Play className="mr-3 h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Untitled short</span>
                <span className="ml-auto font-mono text-xs text-foreground/40">
                  00:00:00 / 00:00:18
                </span>
              </div>
              <div className="grid min-h-[330px] grid-cols-[1.3fr_1fr]">
                <div className="flex items-center justify-center border-r border-border bg-black">
                  <div className="aspect-[9/16] h-[270px] rounded-lg border border-white/10 bg-gradient-to-b from-[#181820] to-[#09090d]" />
                </div>
                <div className="space-y-5 p-5">
                  <div>
                    <div className="mb-2 h-2 w-20 rounded-full bg-foreground/10" />
                    <div className="h-9 rounded-lg border border-border bg-background" />
                  </div>
                  <div>
                    <div className="mb-2 h-2 w-28 rounded-full bg-foreground/10" />
                    <div className="h-20 rounded-lg border border-border bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-10 rounded-lg bg-primary/12" />
                    <div className="h-10 rounded-lg border border-border" />
                  </div>
                </div>
              </div>
              <div className="border-t border-border bg-[hsl(var(--timeline-canvas))] p-4">
                <div className="mb-3 flex gap-2">
                  <div className="h-7 w-[38%] rounded-md border border-primary/40 bg-primary/20" />
                  <div className="h-7 flex-1 rounded-md border border-[hsl(var(--timeline-clip-border))] bg-[hsl(var(--timeline-clip))]" />
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-[25%] rounded bg-foreground/10" />
                  <div className="h-5 w-[42%] rounded bg-foreground/10" />
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function EntryDemo() {
  const [key, setKey] = useState(0);
  const [done, setDone] = useState(false);

  useLayoutEffect(() => {
    const requestedTheme = new URLSearchParams(window.location.search).get("theme");
    if (requestedTheme !== "dark" && requestedTheme !== "light") return;

    document.documentElement.classList.toggle("dark", requestedTheme === "dark");
    document.documentElement.classList.toggle("light", requestedTheme === "light");
  }, []);

  // Clear sessionStorage so animation always plays on this demo page
  useEffect(() => {
    sessionStorage.removeItem("entryAnimPlayed");
  }, [key]);

  const handleReplay = useCallback(() => {
    setDone(false);
    setKey((k) => k + 1);
  }, []);

  return (
    <div className="relative w-screen h-screen">
      <StudioUnderlay />
      <EntryAnimation
        key={key}
        force
        onComplete={() => setDone(true)}
      />
      {done && (
        <div className="absolute bottom-6 right-6 z-50">
          <button
            onClick={handleReplay}
            className="rounded-full border border-border bg-surface/90 px-5 py-2.5 text-sm font-medium shadow-card backdrop-blur hover:bg-surface"
          >
            Replay animation
          </button>
        </div>
      )}
    </div>
  );
}
