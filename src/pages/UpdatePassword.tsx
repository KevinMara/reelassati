import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const { user, recoverySession, updatePassword, loading, error, clearError } =
    useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    if (await updatePassword(password)) {
      setUpdated(true);
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 900);
    }
  };

  const hasRecoveryAccess = Boolean(user || recoverySession);

  return (
    <AuthShell>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-wash text-primary">
        <KeyRound className="h-5 w-5" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use at least 8 characters. Your new password replaces the old one
        immediately.
      </p>
      {updated ? (
        <div className="mt-7 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-500" />
          <p className="font-medium">Password updated</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account is secure. Opening your workspace…
          </p>
        </div>
      ) : !hasRecoveryAccess && !loading ? (
        <div className="mt-7 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm">
          <p className="font-medium">This reset link is missing or expired.</p>
          <p className="mt-1 text-muted-foreground">
            Request a fresh link to securely choose a new password.
          </p>
          <Link
            to="/auth/forgot-password"
            className="mt-4 inline-flex items-center gap-2 font-medium text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Request another link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            New password
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
          <label className="block text-sm font-medium">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={event => {
                clearError();
                setMismatch(false);
                setConfirmation(event.target.value);
              }}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-background/70 px-3 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              placeholder="Repeat your new password"
            />
          </label>
          {mismatch ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              The passwords do not match.
            </p>
          ) : error ? (
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
            {loading ? "Updating…" : "Update password"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}
    </AuthShell>
  );
}
