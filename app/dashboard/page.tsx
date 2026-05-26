'use client';

import React, { useEffect, useState } from "react";
import { Loader2, LogOut, Upload } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (data.ok) {
          setUser(data.user);
        } else {
          window.location.href = "/auth/login";
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/auth/login";
    } catch (err) {
      toast.error("Errore durante il logout.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5E4BC6]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-black/[0.08] dark:border-white/[0.08] h-16 flex items-center justify-between px-6">
        <Logo size="md" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground/60 hidden sm:inline-block">
            {user?.email}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl px-6 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-semibold tracking-tight">
            Benvenuto, {user?.display_name || 'Utente'}
          </h1>
          <p className="mt-2 text-foreground/60">
            Bentornato nella tua dashboard Reelassati.
          </p>
        </div>

        <div className="grid gap-6">
          <div className="bg-white dark:bg-[#1E1D1C] border border-black/[0.08] dark:border-white/[0.08] rounded-xl p-8 shadow-sm">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-[#5E4BC6]/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-[#5E4BC6]" />
              </div>
              <div>
                <h3 className="text-xl font-medium">Inizia una nuova analisi</h3>
                <p className="text-foreground/60 mt-1">Carica il tuo video per iniziare.</p>
              </div>
              <div className="pt-4">
                <div className="bg-black/5 dark:bg-white/5 rounded-lg px-6 py-4 border border-dashed border-black/10 dark:border-white/10">
                  <p className="text-sm font-medium text-foreground/50">
                    Upload flow coming next
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
