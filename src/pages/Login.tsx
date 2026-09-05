import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { useAuth } from "@/hooks/useAuth";
import posthog from "@/lib/posthog";
import {
  consumeAuthNext,
  rememberAuthNext,
  safeDashboardNext,
} from "@/lib/auth-next";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const requestedNext = searchParams.get("next");

  useEffect(() => {
    rememberAuthNext(requestedNext);
    if (user) navigate(consumeAuthNext(requestedNext), { replace: true });
  }, [navigate, requestedNext, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await login(email, password)) {
      posthog?.capture("studio_access_opened");
      navigate(consumeAuthNext(requestedNext), { replace: true });
    }
  };

  return (
    <AuthShell>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary-wash text-primary shadow-[inset_0_1px_rgba(255,255,255,0.25),0_12px_35px_-18px_hsl(var(--primary))]">
        <LockKeyhole className="h-5 w-5" />
      </div>
      <p className="mono-eyebrow mb-2 text-primary">SECURE ACCOUNT</p>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("auth.login.title")}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("auth.login.subtitle")}
      </p>

      <div className="mt-7">
        <SocialAuthButtons />
      </div>

      <form onSubmit={submit} className="space-y-4">
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
        <label className="block text-sm font-medium">
          <span className="flex items-center justify-between">
            {t("auth.password")}
            <Link
              to="/auth/forgot-password"
              className="text-xs font-normal text-primary hover:text-primary-hover"
            >
              {t("auth.forgot_password")}
            </Link>
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={event => {
              clearError();
              setPassword(event.target.value);
            }}
            className="mt-2 h-11 w-full rounded-xl border border-border bg-background/70 px-3 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
            placeholder={t("auth.placeholder_password")}
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
          className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground shadow-[0_14px_30px_-16px_hsl(var(--primary))] transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_18px_36px_-16px_hsl(var(--primary))] disabled:opacity-50"
        >
          {loading ? "Signing in…" : t("auth.login_btn")}
          {!loading ? (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          ) : null}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.no_account")}{" "}
        <Link
          to={`/auth/signup?next=${encodeURIComponent(safeDashboardNext(requestedNext))}`}
          className="font-medium text-primary hover:text-primary-hover"
        >
          {t("auth.signup_btn")}
        </Link>
      </p>
    </AuthShell>
  );
}
