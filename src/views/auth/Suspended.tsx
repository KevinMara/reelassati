import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert, Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function Suspended() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (state === "loggedIn") {
      navigate("/dashboard", { replace: true });
    }
  }, [state, navigate]);

  return (
    <AuthLayout
      title={t("auth.suspended_title")}
      sub={t("auth.suspended_sub")}
    >
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="h-8 w-8" />
          </div>
        </div>
        <p className="text-foreground/70 leading-relaxed">
          {t("auth.suspended_body")}
        </p>
        <div className="space-y-3">
          <Button asChild variant="primary" className="w-full">
            <Link to="/support">
              <Mail className="mr-2 h-4 w-4" />
              {t("auth.contact_support")}
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/">
              {t("auth.pending_back_home")}
            </Link>
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
