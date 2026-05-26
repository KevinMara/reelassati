import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthLayout, Field } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if we have a session (the link from email automatically sets it)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error("Sessione scaduta o non valida.");
        navigate("/auth/login");
      }
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        toast.error(error.message || t("auth.toast.generic_error"));
        return;
      }
      toast.success(t("auth.toast.password_updated"));
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.reset_title")}
      sub={t("auth.reset_sub")}
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field
          name="password"
          type={show ? "text" : "password"}
          label={t("auth.new_password")}
          required
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          disabled={loading}
          rightSlot={
            <button type="button" onClick={() => setShow((s) => !s)} className="text-foreground/50 hover:text-foreground transition-colors">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full justify-center mt-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.update_password")}
        </Button>
      </form>
    </AuthLayout>
  );
}
