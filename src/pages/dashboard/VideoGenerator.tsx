import { useState, useRef } from "react";
import { Wand2, Film, Clock, Image, DollarSign, Loader2, Download, AlertCircle, Volume2, ImagePlus, X } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";

const RATIOS = [
  { id: "9:16" as const, name: "9:16", desc: "TikTok / Reels / Shorts" },
  { id: "16:9" as const, name: "16:9", desc: "YouTube / Landscape" },
  { id: "1:1" as const, name: "1:1", desc: "Instagram / Square" },
];

const DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<"16:9" | "9:16" | "1:1">("9:16");
  const [duration, setDuration] = useState(5);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [cfgScale, setCfgScale] = useState(0.5);
  const [firstFrameUrl, setFirstFrameUrl] = useState("");
  const [lastFrameUrl, setLastFrameUrl] = useState("");
  const [result, setResult] = useState<{
    videoUrl?: string;
    thumbnailUrl?: string;
    cost: number;
    hasAudio: boolean;
    jobId?: number;
  } | null>(null);

  const firstFrameInput = useRef<HTMLInputElement>(null);
  const lastFrameInput = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const configQuery = trpc.video.config.useQuery(undefined, { retry: false });
  const isEnabled = configQuery.data?.enabled ?? false;
  const modelConfig = configQuery.data?.model;

  const generate = trpc.video.generate.useMutation({
    onSuccess: (data) => {
      setResult({
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        cost: data.cost,
        hasAudio: data.hasAudio,
        jobId: data.jobId,
      });
      utils.video.config.invalidate();
    },
  });

  const estimatedCost = (duration * (generateAudio ? 0.126 : 0.084)).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">AI Video Studio</p>
        <h1 className="text-3xl font-semibold">Generate Video</h1>
        <p className="text-foreground/60 mt-2">
          Kling v3.0 Standard — video + native audio in a single pass
        </p>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full font-medium">
            <Volume2 className="h-3 w-3" /> Native audio included
          </span>
          <span className="text-xs text-foreground/40 bg-surface px-2.5 py-1 rounded-full">
            720p | up to 15s | 9:16 / 16:9 / 1:1
          </span>
          <span className="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full font-medium">
            {modelConfig?.costAudio}/sec with audio
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
          {/* Model Info */}
          <div className="bg-surface border border-primary/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Kling v3.0 Standard</h3>
                <p className="text-xs text-foreground/40">By Kuaishou (KwaiVG)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-background">
                <span className="text-foreground/40">Resolution</span>
                <p className="font-medium">720p</p>
              </div>
              <div className="p-2 rounded bg-background">
                <span className="text-foreground/40">Max Duration</span>
                <p className="font-medium">15 seconds</p>
              </div>
              <div className="p-2 rounded bg-background">
                <span className="text-foreground/40">Audio</span>
                <p className="font-medium text-emerald-500">Native</p>
              </div>
              <div className="p-2 rounded bg-background">
                <span className="text-foreground/40">Image-to-Video</span>
                <p className="font-medium text-primary">First + Last frame</p>
              </div>
            </div>
          </div>

          {/* Ratio */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              Aspect Ratio
            </h3>
            <div className="grid grid-cols-3 gap-2">
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
                  className={`px-2.5 py-1.5 rounded-lg border text-sm transition-all ${
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
                ? "Video includes synchronized audio (ambient sound, effects, dialogue). Kling generates both together."
                : "Silent video only. Saves 33% cost."}
            </p>
          </div>

          {/* Negative Prompt */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium mb-2">Negative Prompt</h3>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="What to avoid: blurry, dark, watermark, text..."
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* CFG Scale */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Prompt Adherence (CFG)</h3>
              <span className="text-xs text-primary font-medium">{cfgScale.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={cfgScale}
              onChange={(e) => setCfgScale(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-foreground/30 mt-1">
              <span>Creative</span>
              <span>Strict</span>
            </div>
          </div>

          {/* First / Last Frame (Image-to-Video) */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-primary" />
              Image-to-Video (Optional)
            </h3>
            <div className="space-y-3">
              {/* First Frame */}
              <div>
                <p className="text-xs text-foreground/50 mb-1.5">First Frame</p>
                {firstFrameUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={firstFrameUrl} alt="First frame" className="w-full h-24 object-cover" />
                    <button
                      onClick={() => setFirstFrameUrl("")}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => firstFrameInput.current?.click()}
                    className="w-full h-16 border border-dashed border-border rounded-lg flex items-center justify-center text-xs text-foreground/40 hover:border-primary/50 transition-colors"
                  >
                    + Upload starting image
                  </button>
                )}
                <input
                  ref={firstFrameInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setFirstFrameUrl(url);
                    }
                  }}
                />
              </div>
              {/* Last Frame */}
              <div>
                <p className="text-xs text-foreground/50 mb-1.5">Last Frame</p>
                {lastFrameUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={lastFrameUrl} alt="Last frame" className="w-full h-24 object-cover" />
                    <button
                      onClick={() => setLastFrameUrl("")}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => lastFrameInput.current?.click()}
                    className="w-full h-16 border border-dashed border-border rounded-lg flex items-center justify-center text-xs text-foreground/40 hover:border-primary/50 transition-colors"
                  >
                    + Upload ending image
                  </button>
                )}
                <input
                  ref={lastFrameInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setLastFrameUrl(url);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/60">Estimated cost</span>
              <span className="text-lg font-semibold text-primary">${estimatedCost}</span>
            </div>
            <p className="text-xs text-foreground/40 mt-1">
              {duration}s at 720p {generateAudio ? "with audio" : "silent"}
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
              placeholder="Describe your video scene. For talking-head content, include dialogue in quotes. Example: A young woman in a bright studio holding a skincare bottle, saying 'This completely changed my skin in just one week', enthusiastic smile, natural lighting..."
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
                  duration,
                  ratio,
                  generateAudio,
                  negativePrompt: negativePrompt || undefined,
                  cfgScale: cfgScale !== 0.5 ? cfgScale : undefined,
                  firstFrameUrl: firstFrameUrl || undefined,
                  lastFrameUrl: lastFrameUrl || undefined,
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
                  Generate — ${estimatedCost}
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
                {result.hasAudio && (
                  <span className="flex items-center gap-1 text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <Volume2 className="h-3 w-3" /> Audio included
                  </span>
                )}
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
            <h4 className="text-sm font-medium mb-2">Kling v3.0 Prompt Tips</h4>
            <ul className="space-y-1.5 text-xs text-foreground/50">
              <li>• Include dialogue in quotes for talking-head: person saying &quot;This is amazing&quot;</li>
              <li>• Describe the full scene: setting, lighting, camera angle, character action</li>
              <li>• Use negative prompt to avoid: blurry, dark, watermark, text, deformities</li>
              <li>• Upload first/last frames for image-to-video (smooth transitions)</li>
              <li>• CFG scale: lower = more creative, higher = strict prompt adherence</li>
              <li>• Add motion descriptions: &quot;walking toward camera&quot;, &quot;product rotating&quot;</li>
              <li>• Kling generates audio natively — describe sound you want in the prompt</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
