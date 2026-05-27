import { useEffect, useState } from "react";
import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { LangSwitcher } from "./LangSwitcher";
import { cn } from "@/lib/utils";

export function MarketingNav() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location?.pathname]);

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
          <LangSwitcher />
          <ThemeToggle />
          <span className="w-px h-5 bg-border mx-1" aria-hidden />
          <Button asChild variant="nav" size="sm">
            <a href="/auth/login">{t("nav.login")}</a>

          </Button>
          <Button asChild variant="primary" size="sm">
            <a href="/auth/signup">{t("nav.start_free")}</a>

          </Button>
        </div>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-pill text-foreground hover:bg-foreground/[0.04]"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sheet */}
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
            <LangSwitcher />
            <ThemeToggle />
          </div>
          <Button asChild variant="outline" size="lg" className="mt-3 w-full">
            <Link to="/auth/login">{t("nav.login")}</Link>
          </Button>
          <Button asChild variant="primary" size="lg" className="w-full">
            <Link to="/auth/signup">{t("nav.start_free")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  // Hash links use plain Link to allow same-page anchor behavior
  if (to.includes("#")) {
    return (
      <Link
        to={to}
        className="inline-flex items-center h-9 px-3.5 rounded-pill text-sm text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
      >
        {children}
      </Link>
    );
  }
  return (
    <RouterNavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "inline-flex items-center h-9 px-3.5 rounded-pill text-sm transition-colors",
          isActive
            ? "text-foreground bg-foreground/[0.04]"
            : "text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04]",
        )
      }
    >
      {children}
    </RouterNavLink>
  );
}

function MobileLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="block px-2 py-3 text-lg text-foreground/80 hover:text-foreground border-b border-border last:border-0"
    >
      {children}
    </Link>
  );
}
