import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import AuthShell from "./AuthShell";
import Field from "./Field";
import GoogleButton from "./GoogleButton";
import LoaderDots from "@/components/brand/LoaderDots";
import { useI18n } from "@/lib/i18n";

function getLoginMessage(code: string) {
  if (code === "invalid_credentials") return "Email or password is incorrect.";
  if (code === "invalid_input") return "Enter email and password.";
  if (code === "auth_schema_error") return "Authentication database is being repaired. Try again in a few seconds.";
  if (code === "auth_database_error") return "Authentication is temporarily unavailable.";
  return "Authentication is temporarily unavailable.";
}

export default function Login() {
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const update = (field: string, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorText("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const msg = getLoginMessage(data?.error || "unknown_error");
        setErrorText(msg);
        toast({
          title: msg,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Logged in.",
        description: "Welcome back.",
      });

      navigate("/dashboard");
    } catch {
      const msg = "Network error. Please reload and try again.";
      setErrorText(msg);
      toast({
        title: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.login.title")}
      sub={t("auth.login.sub")}
      footer={
        <>
          {t("auth.login.no_account")}{" "}
          <Link to="/auth/signup" className="text-primary">
            {t("auth.login.signup_link")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field
          name="email"
          label={t("auth.login.email")}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => update("email", event.target.value)}
          required
        />

        <Field
          name="password"
          label={t("auth.login.password")}
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => update("password", event.target.value)}
          required
        />

        {errorText ? (
          <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {errorText}
          </div>
        ) : null}

        <button type="submit" className="btn-hero w-full" disabled={loading}>
          {loading ? <LoaderDots /> : t("auth.login.submit")}
        </button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground/60">
          <span className="h-px flex-1 bg-border" />
          {t("auth.login.or")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButton
          label="Google login non configurato"
          disabled
          onClick={() =>
            toast({
              title: "Google login not configured yet.",
              description: "Email/password login is being restored first.",
            })
          }
        />
      </form>
    </AuthShell>
  );
}
