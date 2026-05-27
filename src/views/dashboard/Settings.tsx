import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Shield, Check, ExternalLink } from "lucide-react";

export default function Settings() {
  const [debug, setDebug] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/auth-debug")
      .then(res => res.json())
      .then(data => setDebug(data))
      .catch(err => console.error("Failed to load debug info", err));
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://reelassati.vercel.app';
  const redirectUri = `${origin}/api/auth/google/callback`;

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Settings</h1>
          <p className="text-foreground/60 text-sm">Configure your Reelassati instance.</p>
        </div>

        <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Google OAuth Setup</h2>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Environment Variables</h3>
                <ul className="space-y-2">
                  <StatusItem label="GOOGLE_CLIENT_ID" active={debug?.googleClientIdConfigured} />
                  <StatusItem label="GOOGLE_CLIENT_SECRET" active={debug?.googleClientSecretConfigured} />
                  <StatusItem label="GOOGLE_REDIRECT_URI" active={debug?.googleRedirectUriConfigured} />
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Database Status</h3>
                <ul className="space-y-2">
                  <StatusItem label="Connected" active={debug?.databaseConnected} />
                  <StatusItem label="Auth Provider Col" active={debug?.usersProfileHasAuthProvider} />
                  <StatusItem label="Google ID Col" active={debug?.usersProfileHasGoogleId} />
                </ul>
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Google Cloud Console Instructions
                <a 
                  href="https://console.cloud.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-normal"
                >
                  Open Console <ExternalLink className="h-3 w-3" />
                </a>
              </h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium text-foreground/80 mb-2">1. Authorized JavaScript origin</p>
                  <code className="bg-background px-3 py-2 rounded border border-border block select-all">
                    {origin}
                  </code>
                </div>
                
                <div>
                  <p className="font-medium text-foreground/80 mb-2">2. Authorized redirect URI</p>
                  <code className="bg-background px-3 py-2 rounded border border-border block select-all">
                    {redirectUri}
                  </code>
                </div>

                <div className="text-xs text-foreground/50 italic bg-primary/5 p-3 rounded border border-primary/10">
                  Tip: Make sure you've enabled the "Google People API" in your Google Cloud project to allow email/profile access.
                </div>
              </div>
            </div>
          </div>
        </section>

        {debug && (
          <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Diagnostics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DebugBadge label="Secret" active={debug.authSecretConfigured} />
              <DebugBadge label="Bcrypt" active={debug.passwordHashLibraryAvailable} />
              <DebugBadge label="Auth Provider" active={debug.usersProfileHasAuthProvider} />
              <DebugBadge label="Google Auth" active={debug.googleAuthConfigured} />
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function StatusItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <li className="flex items-center justify-between text-xs py-1">
      <span className="text-foreground/70">{label}</span>
      {active ? (
        <span className="flex items-center gap-1 text-green-500 font-medium">
          <Check className="h-3 w-3" /> Configured
        </span>
      ) : (
        <span className="text-foreground/30">Missing</span>
      )}
    </li>
  );
}

function DebugBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={cn(
      "px-3 py-2 rounded-lg text-center text-xs font-medium border",
      active 
        ? "bg-green-500/10 text-green-600 border-green-500/20" 
        : "bg-red-500/10 text-red-600 border-red-500/20"
    )}>
      {label}
    </div>
  );
}

import { cn } from "@/lib/utils";
