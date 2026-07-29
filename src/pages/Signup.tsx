import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Globe, Moon, Sparkles, Sun } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";

export default function Signup() {
  const { i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { enterStudio, loading, error } = useAuth();
  const navigate = useNavigate();
  const [attempted, setAttempted] = useState(false);

  const createWorkspace = async () => {
    setAttempted(true);
    if (await enterStudio()) navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="flex items-center justify-center gap-4 py-6">
        <Link to="/" aria-label="REELassati home">
          <Logo size="md" />
        </Link>
        <div className="h-4 w-px bg-border" />
        <button
          onClick={() =>
            i18n.changeLanguage(i18n.language === "it" ? "en" : "it")
          }
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Globe className="h-3.5 w-3.5" />
          {i18n.language === "it" ? "IT" : "EN"}
        </button>
        <button onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <section className="w-full max-w-lg bg-surface border border-border rounded-2xl p-7 shadow-card">
          <div className="h-11 w-11 rounded-xl bg-primary-wash text-primary flex items-center justify-center mb-6">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mono-eyebrow text-primary mb-2">
            Your creator workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Start with a studio, not another blank tool
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            Your private workspace is created from your authenticated identity,
            then projects, edits, assets, and publishing state stay server-side.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            {[
              "Editing-first timeline",
              "Reviewable AI changes",
              "Durable media library",
              "Versioned project state",
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
          </div>

          {attempted && error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}

          <button
            onClick={createWorkspace}
            disabled={loading}
            className="mt-7 w-full h-11 rounded-pill bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
          >
            {loading ? "Preparing workspace…" : "Create my workspace"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </section>
      </main>
    </div>
  );
}
