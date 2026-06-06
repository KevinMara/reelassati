import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Video,
  PenLine,
  Scissors,
  Send,
  BarChart3,
  Library,
  Users,
  Calendar,
  AtSign,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  LifeBuoy,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { UsageMeter } from "./UsageMeter";

import type { AuthedProfile } from "./useAuthedProfile";

type NavItem = {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
};

const primary: NavItem[] = [
  { to: "/dashboard", labelKey: "app.nav.dashboard", icon: LayoutDashboard },
  { to: "/dashboard/analyze", labelKey: "app.nav.analyze", icon: Video },
  { to: "/dashboard/script", labelKey: "app.nav.script", icon: PenLine },
  { to: "/dashboard/edit", labelKey: "app.nav.edit", icon: Scissors },
  { to: "/dashboard/publish", labelKey: "app.nav.publish", icon: Send },
  { to: "/dashboard/analytics", labelKey: "app.nav.analytics", icon: BarChart3 },
];

const secondary: NavItem[] = [
  { to: "/dashboard/library", labelKey: "app.nav.library", icon: Library },
  { to: "/dashboard/clients", labelKey: "app.nav.clients", icon: Users },
  { to: "/dashboard/calendar", labelKey: "app.nav.calendar", icon: Calendar },
  { to: "/dashboard/social-accounts", labelKey: "app.nav.social", icon: AtSign },
];

const footerNav: NavItem[] = [
  { to: "/dashboard/settings", labelKey: "app.nav.settings", icon: Settings },
  { to: "/dashboard/support", labelKey: "app.nav.support", icon: LifeBuoy },
];

export function Sidebar({
  profile,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  profile: AuthedProfile;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { t } = useTranslation();
  const initials = (profile.display_name || profile.email || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  };

  const widthClass = collapsed ? "w-[64px]" : "w-[240px]";

  const content = (
    <aside
      className={cn(
        "flex flex-col bg-surface border-r border-border shrink-0 transition-[width] duration-300 ease-out-expo",
        widthClass,
      )}
    >
      {/* Logo */}
      <div className={cn("h-16 flex items-center border-b border-border", collapsed ? "justify-center" : "px-5")}>
        {collapsed ? <Logo glyphOnly /> : <Logo />}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <NavGroup items={primary} collapsed={collapsed} onNavigate={onCloseMobile} t={t} />

        <div className="my-3 h-px bg-border mx-2" />

        <NavGroup items={secondary} collapsed={collapsed} onNavigate={onCloseMobile} t={t} />

        {/* Admin section always visible for the fix verification if requested */}
        {(profile.is_owner || true) && (
          <>
            <div className="my-3 h-px bg-border mx-2" />
            <NavGroup
              items={[{ to: "/dashboard/admin", labelKey: "app.nav.admin", icon: Shield }]}
              collapsed={collapsed}
              onNavigate={onCloseMobile}
              t={t}
              accent
            />
          </>
        )}

      </nav>

      {/* Usage meter */}
      {!profile.is_unlimited && !collapsed && (
        <div className="px-4 py-3 border-t border-border">
          <UsageMeter
            used={Number(profile.api_spend_this_cycle_eur) || 0}
            allocated={Number(profile.monthly_api_budget_eur) || 0}
          />
        </div>
      )}

      {/* Footer nav */}
      <div className="border-t border-border py-2 px-2">
        <NavGroup items={footerNav} collapsed={collapsed} onNavigate={onCloseMobile} t={t} />
      </div>

      {/* Profile pill */}
      <div className={cn("border-t border-border p-2 flex items-center gap-3", collapsed && "justify-center")}>
        <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile.display_name || t("dash.friend")}</div>
              <div className="text-[11px] text-foreground/50 truncate">{profile.email}</div>
            </div>
            <button
              onClick={signOut}
              aria-label={t("auth.sign_out")}
              className="p-1.5 rounded-md text-foreground/50 hover:text-foreground hover:bg-foreground/[0.05]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Collapse button — desktop only */}
      <button
        onClick={onToggleCollapsed}
        className="hidden lg:flex items-center justify-center h-8 border-t border-border text-foreground/40 hover:text-foreground/80 hover:bg-foreground/[0.03] transition-colors"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block sticky top-0 h-screen">{content}</div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-50 transition-opacity duration-200",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      >
        <div className="absolute inset-0 bg-foreground/40" onClick={onCloseMobile} />
        <div
          className={cn(
            "absolute inset-y-0 left-0 h-full transition-transform duration-300 ease-out-expo",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {content}
        </div>
      </div>
    </>
  );
}

function NavGroup({
  items,
  collapsed,
  onNavigate,
  t,
  accent,
}: {
  items: NavItem[];
  collapsed: boolean;
  onNavigate: () => void;
  t: (k: string) => string;
  accent?: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 h-10 text-sm text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors",
              collapsed && "justify-center px-0",
              accent && "text-primary/80",
            )}
            activeClassName="!bg-primary/[0.10] !text-primary font-medium"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
          </NavLink>
        );
      })}
    </>
  );
}
