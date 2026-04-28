import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function Suspended() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t("auth.suspended_title")} sub={t("auth.suspended_sub")}>
      <div className="flex flex-col items-center text-center gap-5 py-2">
        <div className="h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm text-foreground/70 leading-relaxed max-w-sm">
          {t("auth.suspended_body")}
        </p>
        <div className="flex flex-col gap-2 w-full pt-2">
          <Button asChild variant="primary" size="lg" className="w-full justify-center">
            <Link to="/support?subject=Account+suspended">{t("auth.contact_support")}</Link>
          </Button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="text-xs text-foreground/55 hover:text-foreground transition-colors mt-1"
          >
            {t("auth.sign_out")}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
