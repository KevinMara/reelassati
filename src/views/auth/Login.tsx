import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout, Field, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/admin/auth-check")
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.auth) {
          setGoogleEnabled(data.auth.googleAuth);
        }
      })
      .catch(err => console.error("Failed to check auth status", err));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === "invalid_credentials") {
          toast.error(t("auth.toast.invalid_credentials") || "Email or password is incorrect.");
        } else {
          toast.error(data.error || t("auth.toast.generic_error") || "An error occurred during login.");
        }
        return;
      }
      
      toast.success(t("auth.toast.login_success") || "Successfully logged in!");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(t("auth.toast.generic_error") || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function onGoogle() {
    if (!googleEnabled) return;
    window.location.href = "/api/auth/google";
  }

  return (
    <AuthLayout
      title={t("auth.login.title")}
      sub={t("auth.login.sub")}
      footer={
        <>
          {t("auth.login.no_account")}{" "}
          <Link to="/auth/signup" className="text-primary font-medium hover:underline">
            {t("auth.login.signup_link")}
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field name="email" type="email" label={t("auth.login.email")} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        <div>
          <Field
            name="password"
            type={show ? "text" : "password"}
            label={t("auth.login.password")}
            required
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={loading}
            rightSlot={
              <button type="button" onClick={() => setShow((s) => !s)} className="text-foreground/50 hover:text-foreground transition-colors" aria-label={show ? t("auth.hide") : t("auth.show")}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <div className="mt-2 text-right">
            <Link to="/auth/forgot-password" className="text-xs text-foreground/55 hover:text-foreground transition-colors">
              {t("auth.forgot")}
            </Link>
          </div>
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full justify-center mt-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.login.submit")}
        </Button>

        <Divider label={t("auth.login.or")} />
        <GoogleButton 
          label={googleEnabled ? t("auth.login.google") : "Google login not configured yet."} 
          onClick={onGoogle} 
          disabled={loading || !googleEnabled} 
        />
      </form>
    </AuthLayout>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="mono-eyebrow text-foreground/40 text-[10px]">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
