import { useState } from "react";
import { Wand2, Film, Clock, Image, DollarSign, Loader2, Download, AlertCircle, Volume2, Mic } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";

const MODELS = [
  { id: "alibaba/happyhorse-1.1" as const, name: "HappyHorse 1.1", desc: "Best quality, native audio + lip sync, up to 15s", cost720: "$0.13/sec", cost1080: "$0.16/sec", badge: "AUDIO + LIP SYNC", hasAudio: true, hasLipSync: true },
  { id: "google/veo-3.1-fast" as const, name: "Veo 3.1 Fast", desc: "Fast generation, native audio, up to 8s", cost720: "$0.10/sec", cost1080: "$0.12/sec", badge: "AUDIO", hasAudio: true, hasLipSync: false },
];

const RATIOS = [
  { id: "9:16" as const, name: "9:16", desc: "TikTok / Reels / Shorts" },
  { id: "16:9" as const, name: "16:9", desc: "YouTube / Landscape" },
  { id: "1:1" as const, name: "1:1", desc: "Instagram / Square" },
  { id: "3:4" as const, name: "3:4", desc: "Stories / Portrait" },
];

const DURATIONS = [4, 5, 6, 7, 8, 9, 10];

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"alibaba/happyhorse-1.1" | "google/veo-3.1-fast">("alibaba/happyhorse-1.1");
  const [ratio, setRatio] = useState<"16:9" | "9:16" | "1:1" | "3:4" | "4:3">("9:16");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [result, setResult] = useState<{
    videoUrl?: string;
    thumbnailUrl?: string;
    cost: number;
    jobId?: number;
  } | null>(null);

  const utils = trpc.useUtils();

  const configQuery = trpc.video.config.useQuery(undefined, { retry: false });
  const isEnabled = configQuery.data?.enabled ?? false;

  const generate = trpc.video.generate.useMutation({
    onSuccess: (data) => {
      setResult({
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        cost: data.cost,
        jobId: data.jobId,
      });
      utils.video.config.invalidate();
    },
  });

  const selectedModel = MODELS.find((m) => m.id === model)!;
  const estimatedCost = resolution === "720p"
    ? (duration * (model.includes("happyhorse") ? 0.13 : 0.10)).toFixed(2)
    : (duration * (model.includes("happyhorse") ? 0.16 : 0.12)).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">AI Video Studio</p>
        <h1 className="text-3xl font-semibold">Generate Video</h1>
        <p className="text-foreground/60 mt-2">
          AI generates video with synchronized audio in a single pass
        </p>
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full font-medium">
            <Volume2 className="h-3 w-3" /> Native audio included
          </span>
          <span className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full font-medium">
            <Mic className="h-3 w-3" /> Lip sync on HappyHorse
          </span>
        </div>
      </div>

      {/* Status */}
      {!isEnabled && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-500">
            OpenRouter API key not configured. Add <code className="text-xs bg-amber-500/10 px-1.5 py-0.5 rounded">OPENROUTER_API_KEY</code> to your .env to enable video generation.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Model Selection */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              Model
            </h3>
            <div className="space-y-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    model === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{m.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/50 mt-1">{m.desc}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-xs text-foreground/30">
                      720p: <span className="font-medium">{m.cost720}</span>
                    </p>
                    <p className="text-xs text-foreground/30">
                      1080p: <span className="font-medium">{m.cost1080}</span>
                    </p>
                  </div>
                  {m.hasAudio && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Volume2 className="h-3 w-3 text-emerald-500" />
                      <span className="text-[10px] text-emerald-500">Audio generated with video</span>
                    </div>
                  )}
                  {m.hasLipSync && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Mic className="h-3 w-3 text-primary" />
                      <span className="text-[10px] text-primary">7-language lip sync</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium mb-3">Resolution</h3>
            <div className="flex gap-2">
              {(["720p", "1080p"] as const).map((res) => (
                <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                    resolution === res
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="text-sm font-medium">{res}</span>
                  <p className="text-[10px] text-foreground/40 mt-0.5">
                    {res === "720p" ? "Faster, cheaper" : "Best quality"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Ratio */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              Aspect Ratio
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {RATIOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRatio(r.id)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    ratio === r.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="text-sm font-medium">{r.name}</span>
                  <p className="text-[10px] text-foreground/40 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Duration
            </h3>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                    duration === d
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Audio Toggle */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">Generate Audio</span>
              </div>
              <button
                onClick={() => setGenerateAudio(!generateAudio)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  generateAudio ? "bg-emerald-500" : "bg-foreground/20"
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  generateAudio ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>
            <p className="text-xs text-foreground/40 mt-2">
              {generateAudio
                ? "Video will include synchronized audio (ambient sound, effects, dialogue). Turn off for silent video."
                : "Silent video only. Enable to add native audio generation."}
            </p>
          </div>

          {/* Cost Estimate */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/60">Estimated cost</span>
              <span className="text-lg font-semibold text-primary">${estimatedCost}</span>
            </div>
            <p className="text-xs text-foreground/40 mt-1">
              {duration}s at {resolution} — includes video + audio
            </p>
          </div>
        </div>

        {/* Prompt + Result */}
        <div className="lg:col-span-3 space-y-5">
          {/* Prompt */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium mb-3">Prompt</h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your video scene. For talking-head content, include dialogue in quotes. Example: A young woman in a bright studio holding a skincare product, saying 'This serum changed my skin in just 7 days', enthusiastic expression, natural lighting, 9:16 vertical..."
              rows={6}
              className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-xs text-foreground/30 mt-2 text-right">{prompt.length}/2500</p>

            <button
              onClick={() => {
                if (!prompt.trim()) return;
                setResult(null);
                generate.mutate({
                  prompt,
                  model,
                  duration,
                  ratio,
                  resolution,
                  generateAudio,
                });
              }}
              disabled={!prompt.trim() || generate.isPending || !isEnabled}
              className="mt-4 w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating video + audio... (~30-60s)
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate Video + Audio — ${estimatedCost}
                </>
              )}
            </button>
          </div>

          {/* Result */}
          {result?.videoUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface border border-border rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Generated Video</h3>
                <span className="flex items-center gap-1 text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Volume2 className="h-3 w-3" /> With Audio
                </span>
              </div>
              <div className="relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[500px]">
                <video
                  src={result.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  poster={result.thumbnailUrl}
                />
              </div>
              <div className="flex gap-3 mt-4">
                <a
                  href={result.videoUrl}
                  download
                  className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Video
                </a>
                <button
                  onClick={() => {
                    setResult(null);
                    setPrompt("");
                  }}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-surface transition-colors"
                >
                  New
                </button>
              </div>
            </motion.div>
          )}

          {/* Tips */}
          <div className="p-4 rounded-xl border border-border bg-surface">
            <h4 className="text-sm font-medium mb-2">Prompt Tips for Video + Audio</h4>
            <ul className="space-y-1.5 text-xs text-foreground/50">
              <li>• Include dialogue in quotes: A person saying &quot;This product is amazing&quot;</li>
              <li>• Describe the scene: lighting, setting, camera angle, mood</li>
              <li>• Mention sound: &quot;upbeat music&quot;, &quot;calm ambient noise&quot;, &quot;laughter&quot;</li>
              <li>• Specify camera: &quot;close-up&quot;, &quot;tracking shot&quot;, &quot;static tripod&quot;</li>
              <li>• HappyHorse lip-syncs 7 languages: EN, CN, JP, KR, DE, FR, CA</li>
              <li>• Write dialogue directly in the prompt for talking-head content</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
