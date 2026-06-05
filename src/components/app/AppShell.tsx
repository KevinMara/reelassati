import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AgentChatPanel } from "./AgentChatPanel";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";

const COLLAPSED_KEY = "reelassati.sidebar.collapsed";

export function AppShell({
  children,
  ownerOnly,
  renderWith,
}: {
  children?: React.ReactNode;
  ownerOnly?: boolean;
  renderWith?: (profile: any) => React.ReactNode;
}) {
  const { state, profile } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (state === "loggedOut") {
      navigate("/auth/login", { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (state === "loggedOut" || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar
        profile={profile}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onOpenSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden">
          {renderWith ? renderWith(profile) : children}
        </main>
      </div>
      <AgentChatPanel />
    </div>
  );
}
