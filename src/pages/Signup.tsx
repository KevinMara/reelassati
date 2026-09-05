import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
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

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signup, loading, error, clearError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const requestedNext = searchParams.get("next");

  useEffect(() => {
    rememberAuthNext(requestedNext);
    if (user) navigate(consumeAuthNext(requestedNext), { replace: true });
  }, [navigate, requestedNext, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await signup({ name, email, password });
    if (result.signedIn) {
      posthog?.capture("workspace_creation_opened", {
        confirmation_required: false,
      });
      navigate(consumeAuthNext(requestedNext), { replace: true });
    } else if (result.confirmationRequired) {
      posthog?.capture("workspace_creation_opened", {
        confirmation_required: true,
      });
    }
    setConfirmationSent(result.confirmationRequired);
  };

  return (
    <AuthShell>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary-wash text-primary shadow-[inset_0_1px_rgba(255,255,255,0.25),0_12px_35px_-18px_hsl(var(--primary))]">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="mono-eyebrow mb-2 text-primary">YOUR CREATOR WORKSPACE</p>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("auth.signup.title")}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("auth.signup.subtitle")}
      </p>

      {confirmationSent ? (
        <div className="mt-7 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <Check className="mb-3 h-5 w-5 text-emerald-500" />
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a secure confirmation link to {email}.
          </p>
          <Link
            to={`/auth/login?next=${encodeURIComponent(safeDashboardNext(requestedNext))}`}
            className="mt-4 inline-flex text-sm font-medium text-primary"
          >
            {t("auth.back_to_login")}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-7">
            <SocialAuthButtons />
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">
              {t("auth.name")}
              <input
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={event => {
                  clearError();
                  setName(event.target.value);
                }}
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background/70 px-3 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                placeholder={t("auth.placeholder_name")}
              />
            </label>
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
              {t("auth.password")}
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={event => {
                  clearError();
                  setPassword(event.target.value);
                }}
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background/70 px-3 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                placeholder="At least 8 characters"
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
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground shadow-[0_14px_30px_-16px_hsl(var(--primary))] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? "Creating account…" : t("auth.signup_btn")}
              {!loading ? (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              ) : null}
            </button>
          </form>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing, you agree to REELassati&apos;s{" "}
            <Link
              to="/responsible-use"
              className="text-primary hover:underline"
            >
              Responsible Use terms
            </Link>{" "}
            and acknowledge its{" "}
            <Link
              to="/ai-transparency"
              className="text-primary hover:underline"
            >
              AI and privacy information
            </Link>
            .
          </p>
        </>
      )}
      {!confirmationSent ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.has_account")}{" "}
          <Link
            to={`/auth/login?next=${encodeURIComponent(safeDashboardNext(requestedNext))}`}
            className="font-medium text-primary hover:text-primary-hover"
          >
            {t("auth.login_btn")}
          </Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
