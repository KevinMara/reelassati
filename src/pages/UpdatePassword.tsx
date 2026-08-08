import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const { updatePassword, loading, error, clearError } = useAuth();
  const [password, setPassword] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await updatePassword(password))
      navigate("/dashboard", { replace: true });
  };

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
          {loading ? "Updating…" : "Update password"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthShell>
  );
}
