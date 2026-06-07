import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout, Field, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, refresh } = useAuth();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  // REELASSATI_AUTH_ESCAPE_V1
  useEffect(() => {
    let alive = true;

    const checkSessionAndEnter = async () => {
      try {
        const response = await fetch("/api/auth/me?auth_escape=" + Date.now(), {
          credentials: "include",
          cache: "no-store",
        });

        const data = await response.json();

        if (
          alive &&
          data?.ok === true &&
          data?.user &&
          window.location.pathname.startsWith("/auth")
        ) {
          window.location.replace("/dashboard?from=auth_escape");
        }
      } catch {}
    };

    checkSessionAndEnter();
    const timer = window.setInterval(checkSessionAndEnter, 750);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (state === "loggedIn") {
      navigate("/dashboard", { replace: true });
    }
  }, [state, navigate]);

  // Google OAuth is explicitly disabled in Phase 1
  useEffect(() => {
    setGoogleEnabled(false);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !pw) return;
    
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Invalid server response");
      }
      
      if (!response.ok) {
        if (data.error === "invalid_credentials") {
          toast.error(t("auth.toast.invalid_credentials") || "Email or password is incorrect.");
        } else {
          toast.error(t("auth.toast.generic_error") || "Authentication is temporarily unavailable.");
        }
        return;
      }
      
      toast.success(t("auth.toast.login_success") || "Successfully logged in!");
      await refresh();
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error("Login fetch error:", err);
      if (err.message === "Failed to fetch") {
        toast.error("Network error. Please reload and try again.");
      } else {
        toast.error(t("auth.toast.generic_error") || "Authentication is temporarily unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }

  function onGoogle() {
    // Google OAuth is explicitly disabled in Phase 1
    return;
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
        <Field 
          name="email" 
          type="email" 
          label={t("auth.login.email")} 
          required 
          autoComplete="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          disabled={loading} 
        />
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
              <button 
                type="button" 
                onClick={() => setShow((s) => !s)} 
                className="text-foreground/50 hover:text-foreground transition-colors" 
                aria-label={show ? t("auth.hide") : t("auth.show")}
              >
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
          label="Google login non configurato" 
          onClick={onGoogle} 
          disabled={true} 
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

