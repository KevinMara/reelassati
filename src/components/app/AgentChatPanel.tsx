import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle, X, Send, Video, PenLine, Scissors, Send as SendIcon, BarChart3, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const agentMap: Record<string, { icon: React.ComponentType<{ className?: string }>; key: string }> = {
  "/dashboard/analyze": { icon: Video, key: "analyzer" },
  "/dashboard/script": { icon: PenLine, key: "script" },
  "/dashboard/edit": { icon: Scissors, key: "editor" },
  "/dashboard/publish": { icon: SendIcon, key: "publisher" },
  "/dashboard/analytics": { icon: BarChart3, key: "analytics" },
};

export function AgentChatPanel() {
  const location = useLocation();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "agent"; text: string }[]>([]);

  const agent = useMemo(() => {
    const match = Object.entries(agentMap).find(([p]) => location.pathname.startsWith(p));
    return match?.[1] ?? { icon: LayoutDashboard, key: "studio" };
  }, [location.pathname]);

  const Icon = agent.icon;
  const agentName = t(`app.agents.${agent.key}.name`, { defaultValue: "Studio" });
  const agentGreeting = t(`app.agents.${agent.key}.greeting`, { defaultValue: t("app.agents.studio.greeting") });

  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: input.trim() },
      { role: "agent", text: t("app.agents.placeholder_reply") },
    ]);
    setInput("");
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 ease-out-expo active:scale-95",
          open && "scale-0 opacity-0 pointer-events-none",
        )}
        aria-label="Open agent"
      >
        <Icon className="h-5 w-5" />
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-40 w-[calc(100vw-3rem)] sm:w-[420px] h-[600px] max-h-[calc(100vh-3rem)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out-expo origin-bottom-right",
          open ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none",
        )}
      >
        <div className="h-14 border-b border-border flex items-center gap-3 px-4">
          <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{agentName}</div>
            <div className="text-[11px] text-foreground/50">{t("app.agents.online")}</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-md text-foreground/50 hover:bg-foreground/[0.05]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          <div className="bg-surface border border-border rounded-lg p-3 text-foreground/80">
            {agentGreeting}
          </div>
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg p-3 max-w-[85%]",
                m.role === "user"
                  ? "bg-primary/10 text-foreground ml-auto"
                  : "bg-surface border border-border",
              )}
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("app.agents.input_placeholder")}
            className="flex-1 h-10 px-3 rounded-md bg-surface border border-border text-sm outline-none focus:border-primary/50"
          />
          <button
            onClick={send}
            className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
