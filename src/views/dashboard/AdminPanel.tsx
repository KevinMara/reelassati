import { AppShell } from "@/components/app/AppShell";
import { useTranslation } from "react-i18next";
import { Shield, Users, CreditCard, Settings, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPanel() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header>
          <p className="mono-eyebrow text-primary mb-2">{t("admin.eyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("admin.title")}</h1>
          <p className="text-foreground/60 mt-2">{t("admin.sub")}</p>
        </header>

        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="bg-surface border border-border">
            <TabsTrigger value="requests">{t("admin.tabs.requests")}</TabsTrigger>
            <TabsTrigger value="users">{t("admin.tabs.users")}</TabsTrigger>
            <TabsTrigger value="usage">{t("admin.tabs.usage")}</TabsTrigger>
            <TabsTrigger value="settings">{t("admin.tabs.settings")}</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <div className="bg-surface/50 border border-dashed border-border rounded-xl p-20 text-center">
              <div className="max-w-xs mx-auto">
                <Users className="h-10 w-10 text-foreground/20 mx-auto mb-4" />
                <h3 className="font-semibold text-lg">{t("admin.requests.empty")}</h3>
                <p className="text-sm text-foreground/50 mt-2">{t("admin.coming_soon")}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-6 flex items-center gap-2">
                <Users className="h-4 w-4" /> User Management
              </h3>
              <div className="text-sm text-foreground/40 italic">
                Connect to live user database to manage access.
              </div>
            </div>
          </TabsContent>

          <TabsContent value="usage">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-6 flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> API Spend & Usage
              </h3>
              <div className="text-sm text-foreground/40 italic">
                Real-time usage tracking coming in the next phase.
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-6 flex items-center gap-2">
                <Settings className="h-4 w-4" /> Platform Overrides
              </h3>
              <div className="text-sm text-foreground/40 italic">
                Configure global platform settings and maintenance mode.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
