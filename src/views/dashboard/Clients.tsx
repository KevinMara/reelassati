import { AppShell } from "@/components/app/AppShell";
import { useTranslation } from "react-i18next";
import { Users, Plus, Search, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Clients() {
  const { t } = useTranslation();

  const mockClients = [
    { id: "c1", name: "Pizzeria Marco", industry: "Food & Beverage", posts: 24, health: 92 },
    { id: "c2", name: "Studio Legale Rossi", industry: "Legal", posts: 8, health: 85 },
    { id: "c3", name: "Bottega del Caffè", industry: "Food & Beverage", posts: 12, health: 91 },
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="mono-eyebrow text-primary mb-2">{t("app.nav.clients")}</p>
            <h1 className="text-3xl font-semibold tracking-tight">Client Management</h1>
            <p className="text-foreground/60 mt-2">Manage multiple brands, each with its own voice and accounts.</p>
          </div>
          <Button variant="primary" className="gap-2">
            <Plus className="h-4 w-4" />
            Add new client
          </Button>
        </header>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <Input className="pl-9" placeholder="Search clients..." />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-foreground/45 border-b border-border">
                <th className="text-left font-medium px-6 py-3">Client Name</th>
                <th className="text-left font-medium px-6 py-3">Industry</th>
                <th className="text-right font-medium px-6 py-3">Total Posts</th>
                <th className="text-right font-medium px-6 py-3">Health Score</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mockClients.map((client) => (
                <tr key={client.id} className="border-b border-border/40 last:border-0 hover:bg-surface/40 transition-colors">
                  <td className="px-6 py-4 font-medium">{client.name}</td>
                  <td className="px-6 py-4 text-foreground/60">{client.industry}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{client.posts}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {client.health}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-foreground/30 hover:text-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
