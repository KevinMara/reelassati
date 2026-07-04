import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, X, Globe, Sun, Moon } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location?.pathname]);

  const toggleLang = () => {
    const next = i18n.language === "it" ? "en" : "it";
    i18n.changeLanguage(next);
  };

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300 ease-out-expo",
        scrolled
          ? "bg-background/75 backdrop-blur-xl border-b border-border"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="shrink-0" aria-label="Reelassati home">
          <Logo size="md" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavItem to="/#features">{t("nav.features")}</NavItem>
          <NavItem to="/pricing">{t("nav.pricing")}</NavItem>
          <NavItem to="/support">{t("nav.support")}</NavItem>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={toggleLang}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
          >
            <Globe className="h-3.5 w-3.5" /> {i18n.language === "it" ? "IT" : "EN"}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
          >
            {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <span className="w-px h-5 bg-border mx-1" aria-hidden />
          <Link
            to="/auth/login"
            className="inline-flex items-center h-9 px-3.5 rounded-pill text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
          >
            {t("nav.login")}
          </Link>
          <Link
            to="/auth/signup"
            className="inline-flex items-center h-9 px-4 rounded-pill text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            {t("nav.start_free")}
          </Link>
        </div>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-pill text-foreground hover:bg-foreground/[0.04]"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "md:hidden overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl transition-all duration-300 ease-out-expo",
          open ? "max-h-[420px]" : "max-h-0",
        )}
      >
        <div className="container-page py-6 flex flex-col gap-1">
          <MobileLink to="/#features">{t("nav.features")}</MobileLink>
          <MobileLink to="/pricing">{t("nav.pricing")}</MobileLink>
          <MobileLink to="/support">{t("nav.support")}</MobileLink>
          <div className="h-px bg-border my-3" />
          <div className="flex items-center justify-between">
            <button onClick={toggleLang} className="flex items-center gap-1 text-sm text-muted-foreground">
              <Globe className="h-3.5 w-3.5" /> {i18n.language === "it" ? "IT" : "EN"}
            </button>
            <button onClick={toggleTheme} className="p-1.5 text-muted-foreground">
              {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <Link to="/auth/login" className="mt-3 w-full inline-flex items-center justify-center h-11 text-sm border border-border rounded-pill hover:bg-foreground/[0.04] transition-colors">
            {t("nav.login")}
          </Link>
          <Link to="/auth/signup" className="w-full inline-flex items-center justify-center h-11 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-pill transition-colors">
            {t("nav.start_free")}
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center h-9 px-3.5 rounded-pill text-sm text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors">
      {children}
    </Link>
  );
}

function MobileLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block px-2 py-3 text-lg text-foreground/80 hover:text-foreground border-b border-border last:border-0">
      {children}
    </Link>
  );
}
