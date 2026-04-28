import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MarketingLayout } from "@/components/brand/MarketingLayout";

export default function AdminPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        navigate("/auth/login");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_owner")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!active) return;
      if (!prof?.is_owner) {
        navigate("/dashboard");
        return;
      }
      setAllowed(true);
      setLoading(false);
    });
    return () => { active = false; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground/50">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!allowed) return null;

  return (
    <MarketingLayout>
      <section className="pt-24 pb-32">
        <div className="container-page max-w-3xl">
          <div className="inline-flex items-center gap-2 mono-eyebrow text-primary mb-5">
            <ShieldCheck className="h-4 w-4" />
            {t("admin.eyebrow")}
          </div>
          <h1 className="text-display-lg font-semibold">{t("admin.title")}</h1>
          <p className="mt-6 text-lg text-foreground/70 max-w-xl leading-relaxed">
            {t("admin.placeholder")}
          </p>

          <div className="mt-10 bg-surface border border-dashed border-border rounded-lg p-8 text-sm text-foreground/60">
            {t("admin.coming_soon")}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
