import type { ReactNode } from "react";

type AuthShellProps = {
  title: ReactNode;
  sub?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export default function AuthShell({ title, sub, footer, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-6">
      <div className="mx-auto flex max-w-5xl justify-center">
        <a href="/" className="inline-flex items-center gap-2 text-2xl font-bold">
          <span className="text-primary">⌞</span>
          <span>
            REEL<span className="italic font-normal">assati</span>
          </span>
        </a>
      </div>

      <section className="mx-auto mt-10 max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          {sub ? <p className="mt-3 text-base text-muted-foreground">{sub}</p> : null}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-7 shadow-card">
          {children}
        </div>

        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </section>
    </main>
  );
}
