import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const labels = {
    capabilities: t("nav.features"),
    examples: isItalian ? "Esempi" : "Walkthroughs",
    presets: isItalian ? "Preset" : "Presets",
    access: t("nav.pricing"),
    support: t("nav.support"),
    studio: t("nav.start_free"),
    login: t("nav.login"),
    signup: t("nav.signup"),
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ease-out-expo",
        scrolled
          ? "border-border bg-background/80 backdrop-blur-xl"
          : "border-transparent bg-background/55 backdrop-blur-md"
      )}
    >
      <div className="container-page flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="shrink-0" aria-label="REELassati home">
            <Logo size="md" />
          </Link>
        </div>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label={
            isItalian ? "Navigazione principale" : "Primary navigation"
          }
        >
          <NavItem to="/#features">{labels.capabilities}</NavItem>
          <NavItem to="/showcase">{labels.examples}</NavItem>
          <NavItem to="/templates">{labels.presets}</NavItem>
          <NavItem to="/pricing">{labels.access}</NavItem>
          <NavItem to="/support">{labels.support}</NavItem>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguagePicker compact />
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={
              theme === "light"
                ? isItalian
                  ? "Attiva tema scuro"
                  : "Use dark theme"
                : isItalian
                  ? "Attiva tema chiaro"
                  : "Use light theme"
            }
          >
            {theme === "light" ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          {!authLoading && user ? (
            <Link
              to="/dashboard"
              className="inline-flex h-9 items-center rounded-pill bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
            >
              {labels.studio}
            </Link>
          ) : (
            <>
              <Link
                to="/auth/login"
                className="inline-flex h-9 items-center rounded-pill px-3 text-sm font-medium text-foreground/75 hover:text-foreground"
              >
                {labels.login}
              </Link>
              <Link
                to="/auth/signup"
                className="inline-flex h-9 items-center rounded-pill bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_10px_25px_-14px_hsl(var(--primary))] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
              >
                {labels.signup}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-pill text-foreground hover:bg-foreground/[0.04] md:hidden"
          onClick={() => setOpen(current => !current)}
          aria-label={
            open
              ? isItalian
                ? "Chiudi menu"
                : "Close menu"
              : isItalian
                ? "Apri menu"
                : "Open menu"
          }
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

      <div
        id="mobile-navigation"
        className={cn(
          "overflow-hidden border-t bg-background/95 backdrop-blur-xl transition-all duration-300 ease-out-expo md:hidden",
          open ? "max-h-[520px] border-border" : "max-h-0 border-transparent"
        )}
      >
        <nav
          className="container-page flex flex-col gap-1 py-6"
          aria-label={isItalian ? "Navigazione mobile" : "Mobile navigation"}
        >
          <MobileLink to="/#features" onNavigate={() => setOpen(false)}>
            {labels.capabilities}
          </MobileLink>
          <MobileLink to="/showcase" onNavigate={() => setOpen(false)}>
            {labels.examples}
          </MobileLink>
          <MobileLink to="/templates" onNavigate={() => setOpen(false)}>
            {labels.presets}
          </MobileLink>
          <MobileLink to="/pricing" onNavigate={() => setOpen(false)}>
            {labels.access}
          </MobileLink>
          <MobileLink to="/support" onNavigate={() => setOpen(false)}>
            {labels.support}
          </MobileLink>
          <div className="my-3 h-px bg-border" />
          <div className="flex items-center justify-between">
            <LanguagePicker />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 text-muted-foreground"
              aria-label={
                theme === "light"
                  ? isItalian
                    ? "Attiva tema scuro"
                    : "Use dark theme"
                  : isItalian
                    ? "Attiva tema chiaro"
                    : "Use light theme"
              }
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4" aria-hidden />
              ) : (
                <Moon className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          {!authLoading && user ? (
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-pill bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {labels.studio}
            </Link>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/auth/login"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-pill border border-border text-sm font-medium"
              >
                {labels.login}
              </Link>
              <Link
                to="/auth/signup"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-pill bg-primary text-sm font-medium text-primary-foreground"
              >
                {labels.signup}
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex h-9 items-center rounded-pill px-3 text-sm text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function MobileLink({
  to,
  onNavigate,
  children,
}: {
  to: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="block border-b border-border px-2 py-3 text-lg text-foreground/80 transition-colors last:border-0 hover:text-foreground"
    >
      {children}
    </Link>
  );
}
