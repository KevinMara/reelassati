import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { LangSwitcher } from "@/components/brand/LangSwitcher";
import { cn } from "@/lib/utils";

export function TopBar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const location = useLocation();
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);

  const crumb = location.pathname
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean)
    .map((seg) => seg.replace(/-/g, " "))
    .join(" / ");

  return (
    <>
      <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-4 lg:px-6 gap-3">
        {/* Mobile menu */}
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 -ml-2 rounded-md text-foreground/70 hover:bg-foreground/[0.05]"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <div className="mono-eyebrow text-foreground/50 truncate capitalize">{crumb || "Dashboard"}</div>

        <div className="flex-1" />

        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-surface text-xs text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>{t("app.top.search")}</span>
          <kbd className="ml-2 text-[10px] font-mono bg-foreground/[0.06] px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        {/* Bell */}
        <button
          className="relative p-2 rounded-md text-foreground/70 hover:bg-foreground/[0.05]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <ThemeToggle />
        <LangSwitcher />
      </header>

      {/* Search modal stub */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 transition-opacity",
          searchOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      >
        <div className="absolute inset-0 bg-foreground/30" onClick={() => setSearchOpen(false)} />
        <div className="relative w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl p-4">
          <div className="flex items-center gap-2 text-sm">
            <Search className="h-4 w-4 text-foreground/40" />
            <input
              autoFocus
              placeholder={t("app.top.search_placeholder")}
              className="flex-1 bg-transparent outline-none"
            />
            <kbd className="text-[10px] font-mono text-foreground/40">ESC</kbd>
          </div>
          <div className="mt-6 text-xs text-foreground/40 text-center py-6">
            {t("app.top.search_coming")}
          </div>
        </div>
      </div>
    </>
  );
}
