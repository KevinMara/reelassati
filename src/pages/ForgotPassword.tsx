import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { resetPassword, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSent(await resetPassword(email));
  };

  return (
    <AuthShell>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-wash text-primary">
        <KeyRound className="h-5 w-5" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("auth.forgot.title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("auth.forgot.subtitle")}
      </p>
      {sent ? (
        <div className="mt-7 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-sm">
          {t("auth.forgot.sent")}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            {t("auth.email")}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event => {
                clearError();
                setEmail(event.target.value);
              }}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-background/70 px-3 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              placeholder={t("auth.placeholder_email")}
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Sending…" : t("auth.send_reset")}
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      <Link
        to="/auth/login"
        className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("auth.back_to_login")}
      </Link>
    </AuthShell>
  );
}
