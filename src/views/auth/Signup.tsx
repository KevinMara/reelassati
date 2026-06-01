import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import AuthShell from "./AuthShell";
import Field from "./Field";
import LoaderDots from "@/components/brand/LoaderDots";
import { useI18n } from "@/lib/i18n";

export default function Signup() {
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", accepted: false });
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const update = (field: string, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorText("");

    if (!form.accepted) {
      setErrorText("Accept the terms to continue.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const msg =
          data?.error === "email_already_exists"
            ? "This email already has an account."
            : data?.error === "invalid_input"
              ? "Check name, email and password."
              : data?.message || data?.error || "Authentication is temporarily unavailable.";

        setErrorText(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }

      toast({ title: "Account created." });
      navigate("/dashboard");
    } catch {
      const msg = "Network error. Preview protection may still be blocking the API.";
      setErrorText(msg);
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.signup.title")}
      sub={t("auth.signup.sub")}
      footer={
        <>
          {t("auth.signup.has_account")}{" "}
          <Link to="/auth/login" className="text-primary">
            {t("auth.signup.login_link")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" data-auth-version="email-api-v3">
        <Field name="name" label={t("auth.signup.name")} autoComplete="name" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("name", e.target.value)} required />
        <Field name="email" label={t("auth.signup.email")} type="email" autoComplete="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("email", e.target.value)} required />
        <Field name="password" label={t("auth.signup.password")} type="password" autoComplete="new-password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("password", e.target.value)} required minLength={8} />

        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input type="checkbox" checked={form.accepted} onChange={(e) => update("accepted", e.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
          <span>{t("auth.signup.terms")}</span>
        </label>

        {errorText ? <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">{errorText}</div> : null}

        <button type="submit" className="btn-hero w-full" disabled={loading}>
          {loading ? <LoaderDots /> : t("auth.signup.submit")}
        </button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground/60">
          <span className="h-px flex-1 bg-border" />
          {t("auth.signup.or")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <button type="button" disabled className="w-full rounded-full border border-border px-4 py-3 text-sm text-muted-foreground opacity-60">
          Google login non configurato
        </button>
      </form>
    </AuthShell>
  );
}
