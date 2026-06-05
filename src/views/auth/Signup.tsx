import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout, Field, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, refresh } = useAuth();
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    if (state === "loggedIn") {
      navigate("/dashboard", { replace: true });
    }
  }, [state, navigate]);

  // Google OAuth is explicitly disabled in Phase 1
  useEffect(() => {
    setGoogleEnabled(false);
  }, []);

  // crude meter, 0–4
  const strength = (() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !pw) return;
    
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: pw }),
      });
      
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Invalid server response");
      }
      
      if (!response.ok) {
        if (data.error === "email_already_exists") {
          toast.error(t("auth.toast.already_registered") || "This email already has an account.");
        } else if (data.error === "invalid_input") {
          toast.error("Please check your input. Name, email and password (min 8 chars) are required.");
        } else if (data.error === "auth_database_error") {
          console.error("Database error details:", data);
          toast.error(t("auth.toast.generic_error") || "Authentication is temporarily unavailable (database error).");
        } else {
          toast.error(t("auth.toast.generic_error") || "Authentication is temporarily unavailable.");
        }
        return;
      }
      
      toast.success(t("auth.toast.signup_success") || "Account created successfully!");
      await refresh();
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error("Signup fetch error:", err);
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
      title={t("auth.signup.title")}
      sub={t("auth.signup.sub")}
      footer={
        <>
          {t("auth.signup.have_account")}{" "}
          <Link to="/auth/login" className="text-primary font-medium hover:underline">
            {t("auth.signup.login_link")}
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field name="name" label={t("auth.signup.name")} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
        <Field name="email" type="email" label={t("auth.signup.email")} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />

        <div>
          <Field
            name="password"
            type={show ? "text" : "password"}
            label={t("auth.signup.password")}
            required
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={loading}
            rightSlot={
              <button type="button" onClick={() => setShow((s) => !s)} className="text-foreground/50 hover:text-foreground transition-colors" aria-label={show ? t("auth.hide") : t("auth.show")}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <div className="mt-2.5 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < strength
                    ? strength <= 1 ? "bg-destructive" : strength === 2 ? "bg-warning" : "bg-success"
                    : "bg-border-strong"
                }`}
              />
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm text-foreground/70 cursor-pointer">
          <Checkbox id="tos" required className="mt-0.5" />
          <span>{t("auth.terms")}</span>
        </label>

        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full justify-center mt-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.signup.submit")}
        </Button>

        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-border" />
          <span className="mono-eyebrow text-foreground/40 text-[10px]">{t("auth.signup.or")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <GoogleButton 
          label="Google login non configurato" 
          onClick={onGoogle} 
          disabled={true} 
        />
      </form>
    </AuthLayout>
  );
}
