import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { LangSwitcher } from "@/components/brand/LangSwitcher";
import { motion } from "framer-motion";

export function AuthLayout({
  title,
  sub,
  children,
  footer,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="container-page flex items-center justify-between h-16">
        <Link to="/" aria-label="Reelassati home"><Logo size="md" /></Link>
        <div className="flex items-center gap-1">
          <LangSwitcher />
          <ThemeToggle />
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

          <div className="bg-surface border border-border rounded-lg shadow-card p-7 md:p-8">
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-foreground/65">{footer}</div>}
        </motion.div>
      </main>

      <footer className="container-page py-6 text-center mono-eyebrow text-foreground/40">
        © {new Date().getFullYear()} Reelassati
      </footer>
    </div>
  );
}

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  rightSlot?: React.ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

export function Field({
  name, label, type = "text", required, autoComplete, rightSlot, value, onChange, disabled,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mono-eyebrow text-foreground/55 mb-2 block">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full bg-surface-recessed border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-md px-4 py-3 text-base outline-none transition-all duration-200 disabled:opacity-60"
        />
        {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
      </div>
    </label>
  );
}

export function GoogleButton({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-3 h-12 rounded-pill border border-border-strong bg-surface text-foreground hover:bg-foreground/[0.03] transition-colors duration-200 text-sm font-medium disabled:opacity-60"
    >
      <GoogleIcon />
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.6 29.5 4.5 24 4.5 16.3 4.5 9.7 8.7 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.4c-1.9 1.4-4.4 2.2-7.4 2.2-5.2 0-9.6-3.4-11.2-8H6.4l-6.4 4.9C3.5 39.6 13 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2 3.9-3.7 5.2l6.3 5.4C42 34.5 44 29.6 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
