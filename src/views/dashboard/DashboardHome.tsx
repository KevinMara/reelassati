import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function DashboardHome() {
  const { state, profile, logout } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (state === "loggedOut") {
      navigate("/auth/login", { replace: true });
    }
  }, [state, navigate]);

  const onLogout = async () => {
    await logout();
    navigate("/auth/login", { replace: true });
  };

  if (state === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "loggedOut") {
    return null;
  }
  
  return (
    <AppShell>
      <div className="p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Welcome, {profile?.display_name || profile?.email}</h1>
          <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
        
        <p className="text-foreground/60">Your Reelassati dashboard is ready.</p>
        
        <div className="grid gap-6 md:grid-cols-3 mt-8">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-2">Analyze Videos</h3>
            <p className="text-sm text-foreground/50 mb-4">Upload and analyze your content with TRIBE intelligence.</p>
            <a href="/dashboard/analyze" className="text-sm text-primary font-medium hover:underline">Get started →</a>
          </div>
          
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-2">Social Accounts</h3>
            <p className="text-sm text-foreground/50 mb-4">Connect your YouTube, TikTok, and Instagram accounts.</p>
            <a href="/dashboard/social-accounts" className="text-sm text-primary font-medium hover:underline">Manage accounts →</a>
          </div>
          
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-2">Library</h3>
            <p className="text-sm text-foreground/50 mb-4">Browse your processed videos and generated scripts.</p>
            <a href="/dashboard/library" className="text-sm text-primary font-medium hover:underline">View library →</a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
