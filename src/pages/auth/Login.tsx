import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout, Field, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  async function routeByAccess(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("access_status, is_owner")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) {
      navigate("/dashboard");
      return;
    }
    if (data.access_status === "pending_approval") {
      navigate("/auth/access-pending");
    } else if (data.access_status === "suspended") {
      navigate("/auth/suspended");
    } else {
      navigate("/dashboard");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) {
        if (error.message.toLowerCase().includes("invalid")) {
          toast.error(t("auth.toast.invalid_credentials"));
        } else {
          toast.error(error.message || t("auth.toast.generic_error"));
        }
        return;
      }
      if (data.user) await routeByAccess(data.user.id);
      else navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(t("auth.toast.generic_error"));
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/dashboard");
  }

  return (
    <AuthLayout
      title={t("auth.login_title")}
      sub={t("auth.login_sub")}
      footer={
        <>
          {t("auth.no_account")}{" "}
          <Link to="/auth/signup" className="text-primary font-medium hover:underline">
            {t("auth.sign_up")}
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field name="email" type="email" label={t("auth.email")} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        <div>
          <Field
            name="password"
            type={show ? "text" : "password"}
            label={t("auth.password")}
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.login_btn")}
        </Button>

        <Divider label={t("auth.or")} />
        <GoogleButton label={t("auth.continue_google")} onClick={onGoogle} disabled={loading} />
      </form>
    </AuthLayout>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-border" />
      <span className="mono-eyebrow text-foreground/40">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
