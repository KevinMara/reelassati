import { useState } from "react";
import { Send, Clock, Calendar, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-black text-white",
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500 text-white",
  youtube: "bg-red-600 text-white",
  x: "bg-slate-900 text-white",
  facebook: "bg-blue-600 text-white",
  linkedin: "bg-blue-700 text-white",
  pinterest: "bg-red-700 text-white",
  threads: "bg-slate-900 text-white",
  reddit: "bg-orange-600 text-white",
  bluesky: "bg-sky-500 text-white",
  telegram: "bg-sky-600 text-white",
  discord: "bg-indigo-500 text-white",
};

export default function PublisherPage() {
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [publishResult, setPublishResult] = useState<string>("");

  const utils = trpc.useUtils();

  // ── Fetch connected accounts ───────────────────────────────────────────────
  const accountsQuery = trpc.platform.list.useQuery(undefined, { retry: false });
  const connectedAccounts = (accountsQuery.data || []).filter(
    (a) => a.status === "connected" && a.zernioAccountId
  );

  // ── Fetch publishing schedule ──────────────────────────────────────────────
  const scheduleQuery = trpc.schedule.list.useQuery(undefined, { retry: false });
  const scheduledPosts = scheduleQuery.data || [];

  // ── Mutations ──────────────────────────────────────────────────────────────
  const publishMutation = trpc.platform.publish.useMutation({
    onSuccess: (data) => {
      setPublishResult(`Published! Post ID: ${data?.postId || "ok"}`);
      setCaption("");
      setHashtags("");
      setSelectedAccounts([]);
      utils.schedule.list.invalidate();
    },
    onError: (err) => setPublishResult(`Error: ${err.message}`),
  });

  const scheduleMutation = trpc.platform.schedule.useMutation({
    onSuccess: (data) => {
      setPublishResult(`Scheduled! Post ID: ${data?.postId || "ok"}`);
      setCaption("");
      setHashtags("");
      setSelectedAccounts([]);
      setScheduleDate("");
      setScheduleTime("");
      utils.schedule.list.invalidate();
    },
    onError: (err) => setPublishResult(`Error: ${err.message}`),
  });

  // ── Toggle account selection ───────────────────────────────────────────────
  const toggleAccount = (id: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ── Build hashtag array ────────────────────────────────────────────────────
  const hashtagArray = hashtags
    .split(/[\s,]+/)
    .map((h) => h.trim().replace(/^#/, ""))
    .filter(Boolean);

  // ── Publish Now ────────────────────────────────────────────────────────────
  const handlePublish = () => {
    if (!caption.trim() || selectedAccounts.length === 0) return;
    setPublishResult("");
    // Publish to each selected account
    selectedAccounts.forEach((accountId) => {
      publishMutation.mutate({
        accountId,
        content: caption,
        hashtags: hashtagArray,
      });
    });
  };

  // ── Schedule Post ──────────────────────────────────────────────────────────
  const handleSchedule = () => {
    if (!caption.trim() || selectedAccounts.length === 0 || !scheduleDate || !scheduleTime) return;
    setPublishResult("");
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    selectedAccounts.forEach((accountId) => {
      scheduleMutation.mutate({
        accountId,
        content: caption,
        hashtags: hashtagArray,
        scheduledAt,
      });
    });
  };

  const isPublishing = publishMutation.isPending || scheduleMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Smart Publisher</p>
        <h1 className="text-3xl font-semibold">Publish</h1>
        <p className="text-foreground/60 mt-2">Schedule and publish content to all your connected platforms</p>
      </div>

      {/* No Connected Accounts Warning */}
      {connectedAccounts.length === 0 && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-amber-500">
              No connected accounts. Go to <strong>Social Hub</strong> to connect your platforms first.
            </p>
          </div>
        </div>
      )}

      {/* Publish Result */}
      {publishResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-xl border ${
            publishResult.startsWith("Error")
              ? "border-red-500/20 bg-red-500/5 text-red-500"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
          }`}
        >
          {publishResult}
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Publishing Queue */}
        <div className="lg:col-span-1">
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="font-medium mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Publishing Queue
            </h2>
            {scheduledPosts.length > 0 ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {scheduledPosts.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-border bg-background"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PLATFORM_COLORS[item.platform] || "bg-primary text-white"}`}>
                        {item.platform}
                      </span>
                      <span className={`text-[10px] ${item.status === "published" ? "text-emerald-500" : item.status === "pending" ? "text-amber-500" : "text-foreground/40"}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{item.caption || "Untitled"}</p>
                    <p className="text-xs text-foreground/40 mt-1">
                      {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "No date"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-foreground/40">No scheduled posts yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Publish Form */}
        <div className="lg:col-span-2">
          <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
            <h2 className="font-medium flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              New Publication
            </h2>

            {/* Account Selection (from connected Zernio accounts) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Accounts ({selectedAccounts.length} selected)
              </label>
              {connectedAccounts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {connectedAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => toggleAccount(account.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                        selectedAccounts.includes(account.id)
                          ? PLATFORM_COLORS[account.platform] || "bg-primary text-white ring-2 ring-primary/30"
                          : "bg-background border border-border text-foreground/50 hover:border-primary/50"
                      }`}
                    >
                      {account.accountName || account.platform}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/40 py-3 px-4 bg-background rounded-lg border border-dashed border-border">
                  Connect accounts in Social Hub to publish
                </p>
              )}
            </div>

            {/* Caption */}
            <div>
              <label className="block text-sm font-medium mb-2">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm font-medium mb-2">Hashtags</label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="viral, trending, fyp (comma or space separated)"
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm"
                />
              </div>
            </div>

            {/* AI Suggestions */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium text-primary mb-2">AI Suggestions</p>
              <div className="space-y-1">
                <p className="text-xs text-foreground/70">Best time for TikTok: <span className="font-medium">7:00 PM - 9:00 PM</span></p>
                <p className="text-xs text-foreground/70">Optimal hashtags: <span className="font-medium">fyp, viral, trending</span></p>
                <p className="text-xs text-foreground/70">Caption length: <span className="font-medium">Keep under 100 characters for max engagement</span></p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSchedule}
                disabled={isPublishing || !caption.trim() || selectedAccounts.length === 0 || !scheduleDate || !scheduleTime}
                className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {scheduleMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scheduling...</>
                ) : (
                  <><Calendar className="h-4 w-4" /> Schedule Post</>
                )}
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || !caption.trim() || selectedAccounts.length === 0}
                className="flex-1 py-3 border border-border rounded-lg font-medium hover:bg-surface transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {publishMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Publishing...</>
                ) : (
                  <><Send className="h-4 w-4" /> Publish Now</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
