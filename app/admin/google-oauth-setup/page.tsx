'use client';

import React from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, ShieldCheck, Key, Globe } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function GoogleOAuthSetupPage() {
  const redirectUri = "https://reelassati.vercel.app/api/auth/google/callback";

  return (
    <div className="min-h-screen bg-[#FDFDFC] dark:bg-[#121212] text-foreground font-sans p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/settings" className="h-10 w-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <Logo size="md" />
          </div>
          <div className="text-[10px] uppercase tracking-widest font-mono text-foreground/40 bg-black/5 dark:bg-white/5 px-3 py-1 rounded-full">
            Admin / Google OAuth Setup
          </div>
        </header>

        <section className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tight mb-4">Google OAuth Configuration</h1>
          <p className="text-lg text-foreground/60 leading-relaxed">
            Follow these steps to enable Google Login for Reelassati. You will need to configure these settings in the Google Cloud Console.
          </p>
        </section>

        <div className="space-y-8">
          <Step 
            number={1} 
            title="Create a Google Cloud Project" 
            description="Go to the Google Cloud Console and create a new project named 'Reelassati' or select an existing one."
            link="https://console.cloud.google.com/projectcreate"
          />

          <Step 
            number={2} 
            title="Configure OAuth Consent Screen" 
            description={
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>User Type: <span className="font-semibold">External</span></li>
                <li>App name: <span className="font-semibold">Reelassati</span></li>
                <li>User support email: <span className="font-semibold">Your email</span></li>
                <li>Developer contact info: <span className="font-semibold">Your email</span></li>
                <li>Scopes: Add <span className="font-mono text-xs bg-black/5 dark:bg-white/5 px-1">openid</span>, <span className="font-mono text-xs bg-black/5 dark:bg-white/5 px-1">email</span>, <span className="font-mono text-xs bg-black/5 dark:bg-white/5 px-1">profile</span></li>
              </ul>
            }
            link="https://console.cloud.google.com/apis/credentials/consent"
          />

          <Step 
            number={3} 
            title="Create OAuth 2.0 Client ID" 
            description={
              <div className="space-y-4">
                <p>Go to Credentials, click 'Create Credentials' and select 'OAuth client ID'.</p>
                <ul className="list-disc list-inside space-y-2">
                  <li>Application type: <span className="font-semibold">Web application</span></li>
                  <li>Name: <span className="font-semibold">Reelassati Web Client</span></li>
                </ul>
                <div className="mt-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10">
                  <p className="text-xs font-mono uppercase tracking-widest text-foreground/40 mb-2">Authorized JavaScript origins</p>
                  <code className="text-sm font-mono break-all text-[#5E4BC6]">https://reelassati.vercel.app</code>
                </div>
                <div className="mt-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10">
                  <p className="text-xs font-mono uppercase tracking-widest text-foreground/40 mb-2">Authorized redirect URIs</p>
                  <code className="text-sm font-mono break-all text-[#5E4BC6]">{redirectUri}</code>
                </div>
              </div>
            }
            link="https://console.cloud.google.com/apis/credentials"
          />

          <Step 
            number={4} 
            title="Set Environment Variables in Vercel" 
            description={
              <div className="space-y-4">
                <p>Add the following variables to your Vercel project settings:</p>
                <div className="grid gap-3">
                  <EnvVar name="GOOGLE_CLIENT_ID" value="From Google Console" />
                  <EnvVar name="GOOGLE_CLIENT_SECRET" value="From Google Console" />
                  <EnvVar name="GOOGLE_REDIRECT_URI" value={redirectUri} />
                </div>
              </div>
            }
          />
        </div>

        <footer className="mt-20 pt-10 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
          <p className="text-sm text-foreground/40 font-mono">© {new Date().getFullYear()} Reelassati Infrastructure</p>
          <div className="flex items-center gap-6">
            <Link href="/api/admin/auth-check" className="text-xs font-medium hover:text-[#5E4BC6] transition-colors">Check Status</Link>
            <Link href="/api/admin/auth-debug" className="text-xs font-medium hover:text-[#5E4BC6] transition-colors">Debug Info</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Step({ number, title, description, link }: { number: number; title: string; description: React.ReactNode; link?: string }) {
  return (
    <div className="flex gap-6">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#5E4BC6] text-white flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-foreground/40 hover:text-[#5E4BC6] transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        <div className="text-foreground/70 leading-relaxed text-sm">
          {description}
        </div>
      </div>
    </div>
  );
}

function EnvVar({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/5 dark:border-white/5">
      <span className="font-mono text-xs font-semibold">{name}</span>
      <span className="text-[10px] font-mono text-foreground/40 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">{value}</span>
    </div>
  );
}
