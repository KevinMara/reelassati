import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MarketingLayout } from "@/components/brand/MarketingLayout";
import { Button } from "@/components/ui/button";

type Profile = {
  display_name: string | null;
  plan_tier: string;
  access_status: string;
  is_owner: boolean;
};

export default function DashboardHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
        .select("display_name, plan_tier, access_status, is_owner")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!active) return;
      if (prof?.access_status === "pending_approval") {
        navigate("/auth/access-pending");
        return;
      }
      if (prof?.access_status === "suspended") {
        navigate("/auth/suspended");
        return;
      }
      setProfile(prof as Profile);
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

  return (
    <MarketingLayout>
      <section className="pt-24 pb-32">
        <div className="container-page max-w-3xl">
          <p className="mono-eyebrow text-primary mb-5">{t("dash.eyebrow")}</p>
          <h1 className="text-display-lg font-semibold">
            {t("dash.hello", { name: profile?.display_name || t("dash.friend") })}
          </h1>
          <p className="mt-6 text-lg text-foreground/70 max-w-xl leading-relaxed">
            {t("dash.placeholder_body")}
          </p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label={t("dash.plan")} value={t(`pricing.tiers.${profile?.plan_tier || "solo"}.name`, { defaultValue: profile?.plan_tier })} />
            <Stat label={t("dash.status")} value={t(`dash.status_${profile?.access_status}`, { defaultValue: profile?.access_status || "" })} />
            <Stat label={t("dash.role")} value={profile?.is_owner ? t("dash.role_owner") : t("dash.role_user")} />
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {profile?.is_owner && (
              <Button asChild variant="primary" size="lg">
                <a href="/dashboard/admin">{t("dash.open_admin")}</a>
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
            >
              {t("auth.sign_out")}
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="mono-eyebrow text-foreground/50">{label}</div>
      <div className="mt-2 text-lg font-medium capitalize">{value}</div>
    </div>
  );
}
