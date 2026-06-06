import { AppShell } from "@/components/app/AppShell";
import { useTranslation } from "react-i18next";
import { AtSign, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SocialAccounts() {
  const { t } = useTranslation();

  const mockAccounts = [
    { id: 1, platform: "TikTok", handle: "@molino.pizza", status: "Connected" },
    { id: 2, platform: "Instagram", handle: "@pizzeria.molino", status: "Connected" },
    { id: 3, platform: "YouTube", handle: "Molino Reels", status: "Connected" },
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="mono-eyebrow text-primary mb-2">{t("app.nav.social")}</p>
            <h1 className="text-3xl font-semibold tracking-tight">Social Accounts</h1>
            <p className="text-foreground/60 mt-2">Connect your platforms via native OAuth. No passwords stored.</p>
          </div>
          <Button variant="primary" className="gap-2">
            <Plus className="h-4 w-4" />
            Connect new account
          </Button>
        </header>

        <div className="grid gap-4">
          {mockAccounts.map((acc) => (
            <div key={acc.id} className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <AtSign className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold">{acc.platform}</div>
                  <div className="text-sm text-foreground/50">{acc.handle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {acc.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
