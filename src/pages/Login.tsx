import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Globe,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

export default function Login() {
  const { i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { enterStudio, loading, error } = useAuth();
  const navigate = useNavigate();
  const [attempted, setAttempted] = useState(false);

  const continueToStudio = async () => {
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
          type="button"
          onClick={() =>
            i18n.changeLanguage(i18n.language === "it" ? "en" : "it")
          }
          aria-label={
            i18n.language === "it" ? "Switch to English" : "Passa all’italiano"
          }
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Globe className="h-3.5 w-3.5" />
          {i18n.language === "it" ? "IT" : "EN"}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="text-muted-foreground hover:text-foreground"
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <section className="w-full max-w-md bg-surface border border-border rounded-2xl p-7 shadow-card">
          <div className="h-11 w-11 rounded-xl bg-primary-wash text-primary flex items-center justify-center mb-6">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <p className="mono-eyebrow text-primary mb-2">Secure studio access</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Continue to your editing workspace
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            This Studio uses your authenticated workspace identity. REELassati
            never stores a password in the browser.
          </p>

          <div className="mt-6 rounded-xl bg-surface-recessed p-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Server-verified workspace identity
            </div>
            <div className="flex items-center gap-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Private projects, assets, and revisions
            </div>
          </div>

          {attempted && error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={continueToStudio}
            disabled={loading}
            className="mt-6 w-full h-11 rounded-pill bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
          >
            {loading ? "Verifying access…" : "Open my studio"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </section>
      </main>
    </div>
  );
}
