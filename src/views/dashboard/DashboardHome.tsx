import { AppShell } from "@/components/app/AppShell";
import { useAuthedProfile } from "@/components/app/useAuthedProfile";

export default function DashboardHome() {
  const { profile } = useAuthedProfile();
  
  return (
    <AppShell>
      <div className="p-8 space-y-4">
        <h1 className="text-3xl font-bold">Welcome, {profile?.display_name || profile?.email}</h1>
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
