import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

interface PublicComplianceShellProps {
  backLabel: string;
  eyebrow: string;
  title: string;
  intro: string;
  updatedLabel: string;
  children: ReactNode;
}

export function PublicComplianceShell({
  backLabel,
  eyebrow,
  title,
  intro,
  updatedLabel,
  children,
}: PublicComplianceShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pb-8 pt-24">
        <div className="container-page">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-foreground/50 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {backLabel}
          </Link>

          <header className="mt-8 border-b border-border pb-10 md:pb-14">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <p className="mono-eyebrow text-primary">{eyebrow}</p>
                <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-tight md:text-6xl">
                  {title}
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-7 text-foreground/60 md:text-lg">
                  {intro}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-pill border border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-foreground/50">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                {updatedLabel}
              </div>
            </div>
          </header>

          <div className="py-10 md:py-14">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
