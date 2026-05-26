'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Globe, Sun, Moon, Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";

// Shared Auth Components
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

function Field({ name, label, type = "text", required, autoComplete, value, onChange, disabled, rightSlot }: any) {
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
        {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
      </div>
    </label>
  );
}

function GoogleButton({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-3 h-12 rounded-full border border-black/[0.16] dark:border-white/[0.16] bg-white dark:bg-[#1E1D1C] text-foreground hover:bg-foreground/[0.03] transition-colors duration-200 text-sm font-medium disabled:opacity-60"
    >
      <svg className="h-4 w-4" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.6 29.5 4.5 24 4.5 16.3 4.5 9.7 8.7 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.4c-1.9 1.4-4.4 2.2-7.4 2.2-5.2 0-9.6-3.4-11.2-8H6.4l-6.4 4.9C3.5 39.6 13 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2 3.9-3.7 5.2l6.3 5.4C42 34.5 44 29.6 44 24c0-1.3-.1-2.3-.4-3.5z" />
      </svg>
      {label}
    </button>
  );
}

// Signup Page Component
export default function SignupPage() {
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: pw }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "email_already_exists") {
          toast.error("Esiste già un account con questa email.");
        } else {
          toast.error(data.error || "Qualcosa non va. Riprova.");
        }
        return;
      }
      
      toast.success("Account creato con successo!");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    toast.info("Accesso con Google non ancora disponibile.");
  }

  return (
    <AuthWrapper
      title="Crea il tuo account."
      sub="Solo è gratis, per sempre."
      footer={
        <>
          Hai già un account?{" "}
          <Link href="/auth/login" className="text-[#5E4BC6] font-medium hover:underline">
            Accedi
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field name="name" label="Nome" required autoComplete="name" value={name} onChange={(e: any) => setName(e.target.value)} disabled={loading} />
        <Field name="email" type="email" label="Email" required autoComplete="email" value={email} onChange={(e: any) => setEmail(e.target.value)} disabled={loading} />

        <div>
          <Field
            name="password"
            type={show ? "text" : "password"}
            label="Password"
            required
            autoComplete="new-password"
            value={pw}
            onChange={(e: any) => setPw(e.target.value)}
            disabled={loading}
            rightSlot={
              <button type="button" onClick={() => setShow((s) => !s)} className="text-foreground/50 hover:text-foreground transition-colors">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <div className="mt-2.5 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  i < strength
                    ? strength <= 1 ? "bg-red-500" : strength === 2 ? "bg-yellow-500" : "bg-green-500"
                    : "bg-black/[0.1] dark:bg-white/[0.1]"
                )}
              />
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm text-foreground/70 cursor-pointer">
          <input type="checkbox" required className="mt-1 h-4 w-4 rounded border-gray-300 text-[#5E4BC6] focus:ring-[#5E4BC6]" />
          <span>Iscrivendoti accetti i Termini e l'Informativa privacy.</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center h-12 rounded-full bg-[#5E4BC6] text-white hover:bg-[#5E4BC6]/90 transition-colors duration-200 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea account"}
        </button>

        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">oppure</span>
          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
        </div>
        <GoogleButton label="Continua con Google" onClick={onGoogle} disabled={loading} />
      </form>
    </AuthWrapper>
  );
}
