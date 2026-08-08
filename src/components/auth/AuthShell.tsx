import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Film, Layers3, Moon, Sparkles, Sun } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useTheme } from "@/hooks/useTheme";

export function AuthShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 auth-grid opacity-40" />
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-primary/15 blur-[110px] motion-safe:animate-pulse" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-[120px]" />

      <nav className="relative z-20 mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Link to="/" aria-label="REELassati home">
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-3 rounded-pill border border-border/70 bg-background/65 px-3 py-2 shadow-sm backdrop-blur-xl">
          <LanguagePicker compact />
          <span className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 px-5 pb-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-[480px] lg:block [perspective:1200px]">
          <div className="absolute inset-8 rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/14 via-surface/70 to-fuchsia-500/10 shadow-[0_45px_100px_-50px_hsl(var(--primary)/0.65)] backdrop-blur-xl [transform:rotateY(8deg)_rotateX(2deg)]" />
          <div className="absolute left-16 top-20 w-72 rounded-2xl border border-border/70 bg-surface/90 p-5 shadow-2xl backdrop-blur-xl motion-safe:animate-[float_7s_ease-in-out_infinite]">
            <div className="flex items-center justify-between">
              <span className="mono-eyebrow text-primary">CREATIVE SYSTEM</span>
              <Layers3 className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-2 rounded-full bg-primary/80" />
              <div className="h-2 w-4/5 rounded-full bg-primary/35" />
              <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
            </div>
          </div>
          <div className="absolute bottom-20 right-5 w-64 rounded-2xl border border-border/70 bg-surface/90 p-5 shadow-2xl backdrop-blur-xl motion-safe:animate-[float_8s_ease-in-out_infinite_reverse]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-wash text-primary shadow-inner">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">One focused workspace</p>
                <p className="text-xs text-muted-foreground">
                  Edit · review · publish
                </p>
              </div>
            </div>
          </div>
          <Sparkles className="absolute right-24 top-16 h-5 w-5 text-primary/70 motion-safe:animate-pulse" />
        </div>

        <div className="mx-auto w-full max-w-lg rounded-[1.75rem] border border-border/80 bg-surface/88 p-6 shadow-[0_32px_90px_-45px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-8 [transform:translateZ(0)]">
          {children}
        </div>
      </main>
    </div>
  );
}
