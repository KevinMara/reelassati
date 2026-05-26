'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, Globe, Sun, Moon, ArrowLeft, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { useTheme } from "@/lib/theme";

// Shared Auth Components (repeated for isolation as requested)
function AuthWrapper({ title, sub, children, footer }: { title: string; sub: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      <header className="container mx-auto max-w-[1280px] flex items-center justify-between h-16 px-6">
        <Link href="/" aria-label="Reelassati home"><Logo size="md" /></Link>
        <div className="flex items-center gap-1">
          <SimpleLangSwitcher />
          <SimpleThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 text-foreground/60 text-base">{sub}</p>
          </div>

          <div className="bg-white dark:bg-[#1E1D1C] border border-black/[0.08] dark:border-white/[0.08] rounded-lg shadow-lg p-7 md:p-8">
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-foreground/65">{footer}</div>}
        </motion.div>
      </main>

      <footer className="container mx-auto max-w-[1280px] py-6 text-center text-[10px] uppercase tracking-wider font-mono text-foreground/40">
        © {new Date().getFullYear()} Reelassati
      </footer>
    </div>
  );
}

function SimpleThemeToggle() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <button
      onClick={toggle}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors duration-200"
    >
      {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}

function SimpleLangSwitcher() {
  return (
    <div className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors duration-200 text-sm">
      <Globe className="h-4 w-4" />
      <span className="font-mono text-xs uppercase tracking-wider">IT</span>
    </div>
  );
}

// Suspended Page Component
export default function SuspendedPage() {
  return (
    <AuthWrapper
      title="Account in pausa."
      sub="L'accesso è temporaneamente disabilitato."
    >
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8" />
          </div>
        </div>
        <p className="text-foreground/70 leading-relaxed">
          Il tuo account è stato sospeso. Scrivici e risolviamo insieme.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => (window.location.href = "/support")}
            className="w-full inline-flex items-center justify-center h-12 rounded-full bg-[#5E4BC6] text-white hover:bg-[#5E4BC6]/90 transition-colors duration-200 text-sm font-semibold"
          >
            <Mail className="mr-2 h-4 w-4" />
            Contatta il supporto
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full inline-flex items-center justify-center h-12 rounded-full border border-black/[0.16] dark:border-white/[0.16] text-foreground hover:bg-foreground/[0.03] transition-colors duration-200 text-sm font-semibold"
          >
            Torna alla home
          </button>
        </div>
      </div>
    </AuthWrapper>
  );
}
