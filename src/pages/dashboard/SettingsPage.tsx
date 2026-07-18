import { useState } from "react";
import { User, Bell, Shield, Palette, CreditCard, Webhook, Globe, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "security", label: "Security", icon: Shield },
  { id: "integrations", label: "Integrations", icon: Webhook },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Preferences</p>
        <h1 className="text-3xl font-semibold">Settings</h1>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary/10 text-primary" : "text-foreground/60 hover:text-foreground hover:bg-surface"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "profile" && (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-medium">Profile</h2>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                  {user?.name?.[0] || "U"}
                </div>
                <div>
                  <p className="font-medium">{user?.name || "User"}</p>
                  <p className="text-sm text-foreground/50">{user?.email || "user@example.com"}</p>
                </div>
              </div>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name</label>
                  <input defaultValue={user?.name || ""} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input defaultValue={user?.email || ""} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Bio</label>
                  <textarea rows={3} placeholder="Tell us about yourself..." className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm" />
                </div>
              </div>
              <button className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
                Save Changes
              </button>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-medium">Appearance</h2>
              <div>
                <label className="block text-sm font-medium mb-3">Theme</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => theme === "dark" && toggleTheme()}
                    className={`flex-1 p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
                      theme === "light" ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <Sun className="h-6 w-6" />
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  <button
                    onClick={() => theme === "light" && toggleTheme()}
                    className={`flex-1 p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
                      theme === "dark" ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <Moon className="h-6 w-6" />
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Language</label>
                <select defaultValue="en" className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm">
                  <option value="en">English</option>
                  <option value="it">Italian</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "billing" && (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-medium">Billing</h2>
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pro Plan</p>
                    <p className="text-sm text-foreground/60">$49/month — Renews Aug 1, 2024</p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Active</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-background">
                  <p className="text-lg font-semibold">847</p>
                  <p className="text-xs text-foreground/50">Credits left</p>
                </div>
                <div className="p-3 rounded-lg bg-background">
                  <p className="text-lg font-semibold">12</p>
                  <p className="text-xs text-foreground/50">Clients</p>
                </div>
                <div className="p-3 rounded-lg bg-background">
                  <p className="text-lg font-semibold">∞</p>
                  <p className="text-xs text-foreground/50">Storage</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-medium">Notifications</h2>
              {[
                { label: "Content published", desc: "When your scheduled content goes live", default: true },
                { label: "AI job completed", desc: "When AI finishes generating content", default: true },
                { label: "Client activity", desc: "When a client reviews or approves content", default: false },
                { label: "Weekly digest", desc: "Performance summary every Monday", default: true },
                { label: "Credit low alert", desc: "When you're running low on AI credits", default: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-foreground/50">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={item.default} className="sr-only peer" />
                    <div className="w-10 h-5 bg-foreground/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === "security" && (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-medium">Security</h2>
              <div>
                <label className="block text-sm font-medium mb-1.5">Current Password</label>
                <input type="password" className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">New Password</label>
                <input type="password" className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Two-Factor Authentication</label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <span className="text-sm">Status: <span className="text-foreground/50">Not enabled</span></span>
                  <button className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-background">Enable</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-medium">Integrations</h2>
              <p className="text-sm text-foreground/50">Connect REELassati with your favorite tools</p>
              {[
                { name: "Zapier", desc: "Automate workflows between apps", status: "Not connected" },
                { name: "Google Drive", desc: "Import assets directly from Drive", status: "Not connected" },
                { name: "Shopify", desc: "Track revenue from content", status: "Not connected" },
                { name: "Slack", desc: "Get notifications in your workspace", status: "Not connected" },
                { name: "Stripe", desc: "Process client payments", status: "Connected" },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div>
                    <p className="text-sm font-medium">{integration.name}</p>
                    <p className="text-xs text-foreground/50">{integration.desc}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    integration.status === "Connected" ? "text-emerald-500 bg-emerald-500/10" : "text-foreground/40 bg-foreground/5"
                  }`}>
                    {integration.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
