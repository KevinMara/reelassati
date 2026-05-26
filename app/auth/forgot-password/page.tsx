'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Globe, Sun, Moon, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

function Field({ name, label, type = "text", required, autoComplete, value, onChange, disabled }: any) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/55 mb-2 block">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-transparent focus:border-[#5E4BC6] focus:ring-2 focus:ring-[#5E4BC6]/20 rounded-md px-4 py-3 text-base outline-none transition-all duration-200 disabled:opacity-60 text-foreground"
        />
      </div>
    </label>
  );
}

// Forgot Password Page Component
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) {
        toast.error(error.message || "Qualcosa non va. Riprova.");
        return;
      }
      setSent(true);
      toast.success("Se l'email esiste, ti abbiamo inviato un link.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthWrapper title="Recupera l'accesso." sub="Se l'email esiste, ti abbiamo inviato un link.">
        <div className="space-y-6 text-center">
          <p className="text-foreground/70 leading-relaxed">
            Ti mandiamo un link via email.
          </p>
          <button
            onClick={() => (window.location.href = "/auth/login")}
            className="w-full inline-flex items-center justify-center h-12 rounded-full border border-black/[0.16] dark:border-white/[0.16] text-foreground hover:bg-foreground/[0.03] transition-colors duration-200 text-sm font-semibold"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna al login
          </button>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper
      title="Recupera l'accesso."
      sub="Ti mandiamo un link via email."
      footer={
        <Link href="/auth/login" className="text-[#5E4BC6] font-medium hover:underline">
          Torna al login
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field
          name="email"
          type="email"
          label="Email"
          required
          autoComplete="email"
          value={email}
          onChange={(e: any) => setEmail(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center h-12 rounded-full bg-[#5E4BC6] text-white hover:bg-[#5E4BC6]/90 transition-colors duration-200 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invia link di recupero"}
        </button>
      </form>
    </AuthWrapper>
  );
}
