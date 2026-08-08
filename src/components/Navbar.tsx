import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe, Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
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

  const toggleLang = () => {
    void i18n.changeLanguage(isItalian ? "en" : "it");
  };

  const labels = {
    capabilities: isItalian ? "Funzioni" : "Capabilities",
    examples: isItalian ? "Esempi" : "Walkthroughs",
    presets: isItalian ? "Preset" : "Presets",
    access: isItalian ? "Prezzi" : "Pricing",
    support: isItalian ? "Supporto" : "Support",
    studio: isItalian ? "Apri lo Studio" : "Open Studio",
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
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label={isItalian ? "Passa all’inglese" : "Switch to Italian"}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden />{" "}
            {isItalian ? "IT" : "EN"}
          </button>
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
          <Link
            to="/dashboard/edit"
            className="inline-flex h-9 items-center rounded-pill bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {labels.studio}
          </Link>
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
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden />{" "}
              {isItalian ? "IT" : "EN"}
            </button>
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
          <Link
            to="/dashboard/edit"
            onClick={() => setOpen(false)}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-pill bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {labels.studio}
          </Link>
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
