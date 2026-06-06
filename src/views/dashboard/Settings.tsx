import { AppShell } from "@/components/app/AppShell";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, User, Bell, Shield, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";

export default function Settings() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <header>
          <p className="mono-eyebrow text-primary mb-2">{t("app.nav.settings")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Profile & Preferences</h1>
        </header>

        <div className="grid gap-8">
          <section className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-6 flex items-center gap-2">
              <User className="h-4 w-4" /> Personal Information
            </h3>
            <div className="space-y-4 max-w-md">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-foreground/70">Display Name</label>
                <div className="px-3 py-2 bg-foreground/[0.03] border border-border rounded-md text-sm">
                  {profile?.display_name || "Not set"}
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-foreground/70">Email Address</label>
                <div className="px-3 py-2 bg-foreground/[0.03] border border-border rounded-md text-sm">
                  {profile?.email}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-6 flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Subscription & Usage
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Solo Plan</div>
                <div className="text-xs text-foreground/50 mt-1">Free forever. Great for trying the platform.</div>
              </div>
              <Button variant="outline" size="sm">Upgrade plan</Button>
            </div>
          </section>

          <section className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-6 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Security
            </h3>
            <Button variant="outline" size="sm">Update password</Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
