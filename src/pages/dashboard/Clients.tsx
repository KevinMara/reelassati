import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Users, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Client = {
  id: string;
  name: string;
  industry: string | null;
  primary_language: string | null;
  created_at: string;
};

export default function Clients() {
  return <AppShell renderWith={() => <ClientsContent />} />;
}

function ClientsContent() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("id, name, industry, primary_language, created_at")
      .order("created_at", { ascending: false });
    setClients((data as Client[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) return;
    const { error } = await supabase
      .from("clients")
      .insert({ name: name.trim(), industry: industry.trim() || null, user_id: me.user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("clients.created"));
    setName("");
    setIndustry("");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="mono-eyebrow text-primary mb-3">{t("clients.eyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("clients.title")}</h1>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("clients.add")}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-foreground/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("clients.empty_title")}
          body={t("clients.empty_body")}
          action={
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("clients.add")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-surface p-5 hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  {c.industry && (
                    <div className="text-xs text-foreground/50 truncate mt-0.5">{c.industry}</div>
                  )}
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded text-foreground/40 hover:text-destructive hover:bg-destructive/10"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clients.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block">
                {t("clients.name")}
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block">
                {t("clients.industry")}
              </label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={create} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
