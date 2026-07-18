import { useState } from "react";
import { Users, Plus, Search, MoreHorizontal, Edit, Trash2, FileText, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DEMO_CLIENTS = [
  { id: 1, name: "Fashion Brand Co.", brand: "FABCO", niche: "Fashion", status: "active", content: 24, views: "452K", since: "2024-01" },
  { id: 2, name: "FitLife Supplements", brand: "FitLife", niche: "Fitness", status: "active", content: 18, views: "289K", since: "2024-02" },
  { id: 3, name: "Gourmet Kitchen", brand: "Gourmet", niche: "Food", status: "active", content: 12, views: "156K", since: "2024-03" },
  { id: 4, name: "TechZone Electronics", brand: "TechZone", niche: "Tech", status: "paused", content: 8, views: "89K", since: "2024-04" },
  { id: 5, name: "Wellness Hub", brand: "Wellness", niche: "Health", status: "active", content: 15, views: "201K", since: "2024-02" },
  { id: 6, name: "StudioX Creative", brand: "StudioX", niche: "Design", status: "archived", content: 6, views: "45K", since: "2024-01" },
];

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("all");

  const filtered = DEMO_CLIENTS.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="mono-eyebrow text-primary mb-2">Multi-Client</p>
          <h1 className="text-3xl font-semibold">Clients</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-1">
          {["all", "active", "paused", "archived"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-white" : "bg-surface border border-border"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border text-xs uppercase tracking-wider text-foreground/40">
          <div className="col-span-3">Client</div>
          <div className="col-span-2">Niche</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2">Content</div>
          <div className="col-span-2">Views</div>
          <div className="col-span-1">Since</div>
          <div className="col-span-1"></div>
        </div>
        {filtered.map((client) => (
          <div key={client.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border last:border-0 hover:bg-background/50 transition-colors items-center">
            <div className="col-span-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {client.brand.slice(0, 2)}
              </div>
              <div>
                <p className="font-medium text-sm">{client.name}</p>
                <p className="text-xs text-foreground/50">{client.brand}</p>
              </div>
            </div>
            <div className="col-span-2 text-sm text-foreground/70">{client.niche}</div>
            <div className="col-span-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                client.status === "active" ? "text-emerald-500 bg-emerald-500/10" :
                client.status === "paused" ? "text-amber-500 bg-amber-500/10" :
                "text-foreground/40 bg-foreground/5"
              }`}>
                {client.status}
              </span>
            </div>
            <div className="col-span-2 text-sm">{client.content} pieces</div>
            <div className="col-span-2 text-sm font-medium">{client.views}</div>
            <div className="col-span-1 text-sm text-foreground/50">{client.since}</div>
            <div className="col-span-1 flex justify-end gap-1">
              <button className="p-1.5 rounded hover:bg-background"><FileText className="h-3.5 w-3.5 text-foreground/40" /></button>
              <button className="p-1.5 rounded hover:bg-background"><BarChart3 className="h-3.5 w-3.5 text-foreground/40" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border border-border rounded-xl p-6 w-full max-w-md"
            >
              <h2 className="text-lg font-semibold mb-4">Add New Client</h2>
              <div className="space-y-4">
                <input placeholder="Client name" className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-sm" />
                <input placeholder="Brand name" className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-sm" />
                <input placeholder="Niche (e.g., Fashion, Fitness)" className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-sm" />
                <textarea placeholder="Brand voice & guidelines" rows={3} className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium">Cancel</button>
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium">Add Client</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
