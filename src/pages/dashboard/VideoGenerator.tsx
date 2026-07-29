import { useState } from "react";
import { Wand2, Film, Clock, Image, DollarSign, Loader2, Download, AlertCircle, Volume2, Zap, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { VIDEO_PROMPT_TEMPLATES, getTemplateById } from "@/lib/videoPromptTemplates";

const RATIOS = [
  { id: "9:16" as const, name: "9:16", desc: "TikTok / Reels / Shorts" },
  { id: "16:9" as const, name: "16:9", desc: "YouTube / Landscape" },
  { id: "1:1" as const, name: "1:1", desc: "Instagram / Square" },
];

const DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export default function VideoGenerator() {
  const [mode, setMode] = useState<"studio" | "chat">("studio");
  const [prompt, setPrompt] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("ugc_iphone");
  const [ratio, setRatio] = useState<"16:9" | "9:16" | "1:1">("9:16");
  const [duration, setDuration] = useState(5);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [result, setResult] = useState<{
    videoUrl?: string;
    thumbnailUrl?: string;
    cost: number;
    hasAudio: boolean;
    jobId?: number;
  } | null>(null);

  // Chat mode state
  const [chatHistory, setChatHistory] = useState<{role: "user" | "ai"; content: string}[]>([
    { role: "ai", content: "Hey! I'm your AI video editor. Describe what you want to create and I'll handle everything — prompts, templates, settings. You can say things like 'Make me a TikTok about my coffee shop with a vintage camcorder look' or 'Product demo of my skincare line, professional studio style'." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatProcessing, setIsChatProcessing] = useState(false);

  const utils = trpc.useUtils();
  const configQuery = trpc.video.config.useQuery(undefined, { retry: false });
  const isEnabled = configQuery.data?.enabled ?? false;

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

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setResult(null);

    // Build enhanced prompt from template
    const template = getTemplateById(selectedTemplate);
    const enhancedPrompt = template?.buildPrompt(prompt, {
      characterDesc: undefined,
      location: undefined,
      cameraStyle: undefined,
      dialogue: undefined,
    }) || prompt;

    generate.mutate({
      prompt: enhancedPrompt,
      duration,
      ratio,
      generateAudio,
    });
  };

  // Chat-based video generation
  const handleChatSubmit = () => {
    if (!chatInput.trim() || !isEnabled) return;

    const userMsg = chatInput.trim();
    setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
    setChatInput("");
    setIsChatProcessing(true);

    // Parse the natural language command
    const lowerMsg = userMsg.toLowerCase();

    // Detect template from keywords
    let detectedTemplate = "ugc_iphone";
    if (lowerMsg.includes("camcorder") || lowerMsg.includes("vintage") || lowerMsg.includes("dv") || lowerMsg.includes("retro")) {
      detectedTemplate = "dv_camcorder";
    } else if (lowerMsg.includes("studio") || lowerMsg.includes("professional") || lowerMsg.includes("clean")) {
      detectedTemplate = "studio_professional";
    } else if (lowerMsg.includes("cinematic") || lowerMsg.includes("movie") || lowerMsg.includes("film")) {
      detectedTemplate = "cinematic_short";
    } else if (lowerMsg.includes("product") || lowerMsg.includes("demo") || lowerMsg.includes("showcase")) {
      detectedTemplate = "product_demo";
    } else if (lowerMsg.includes("talking") || lowerMsg.includes("review") || lowerMsg.includes("speaking")) {
      detectedTemplate = "talking_head";
    } else if (lowerMsg.includes("walking") || lowerMsg.includes("travel") || lowerMsg.includes("vlog")) {
      detectedTemplate = "street_walking";
    } else if (lowerMsg.includes("educational") || lowerMsg.includes("tutorial") || lowerMsg.includes("explainer")) {
      detectedTemplate = "educational_whiteboard";
    } else if (lowerMsg.includes("night") || lowerMsg.includes("neon") || lowerMsg.includes("cyberpunk")) {
      detectedTemplate = "night_neon";
    } else if (lowerMsg.includes("text") || lowerMsg.includes("motion graphic") || lowerMsg.includes("typography")) {
      detectedTemplate = "minimal_text";
    }

    // Detect ratio
    let detectedRatio: "9:16" | "16:9" | "1:1" = "9:16";
    if (lowerMsg.includes("youtube") || lowerMsg.includes("landscape") || lowerMsg.includes("16:9")) {
      detectedRatio = "16:9";
    } else if (lowerMsg.includes("square") || lowerMsg.includes("instagram feed") || lowerMsg.includes("1:1")) {
      detectedRatio = "1:1";
    }

    // Detect duration
    let detectedDuration = 5;
    const durationMatch = userMsg.match(/(\d+)\s*second/);
    if (durationMatch) {
      detectedDuration = Math.min(15, Math.max(3, parseInt(durationMatch[1])));
    }

    const template = getTemplateById(detectedTemplate);

    // Build the AI response
    setTimeout(() => {
      const aiResponse = `I'll create that for you! Here's my plan:

**Template:** ${template?.name}
**Style:** ${template?.description}
**Ratio:** ${detectedRatio}
**Duration:** ${detectedDuration}s
**Audio:** ${generateAudio ? "Enabled" : "Silent"}

Enhancing your prompt with the ${template?.name} style...`;

      setChatHistory(prev => [...prev, { role: "ai", content: aiResponse }]);

      // Switch to studio mode with detected settings
      setSelectedTemplate(detectedTemplate);
      setRatio(detectedRatio);
      setDuration(detectedDuration);

      // Auto-generate after a brief pause
      setTimeout(() => {
        const enhancedPrompt = template?.buildPrompt(userMsg) || userMsg;
        setPrompt(userMsg);
        setMode("studio");

        setTimeout(() => {
          generate.mutate({
            prompt: enhancedPrompt,
            duration: detectedDuration as 3|4|5|6|7|8|9|10|11|12|13|14|15,
            ratio: detectedRatio,
            generateAudio,
          });
          setIsChatProcessing(false);
        }, 500);
      }, 1500);
    }, 800);
  };

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
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("studio")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "studio" ? "bg-primary text-white" : "bg-surface border border-border text-foreground/60 hover:text-foreground"
          }`}
        >
          <Zap className="h-3.5 w-3.5 inline mr-1.5" /> Studio Mode
        </button>
        <button
          onClick={() => setMode("chat")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "chat" ? "bg-primary text-white" : "bg-surface border border-border text-foreground/60 hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" /> Chat Editor
        </button>
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

      {/* CHAT MODE */}
      <AnimatePresence mode="wait">
        {mode === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col h-[600px]"
          >
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-background border border-border rounded-bl-sm"
                  }`}>
                    <p className="whitespace-pre-line">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isChatProcessing && (
                <div className="flex justify-start">
                  <div className="bg-background border border-border rounded-xl rounded-bl-sm p-3">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Chat Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChatSubmit()}
                  placeholder="Describe your video in natural language..."
                  className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={!chatInput.trim() || isChatProcessing || !isEnabled}
                  className="px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-40"
                >
                  <Wand2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-foreground/30 mt-2">Try: "Make me a vintage camcorder TikTok about my coffee shop" or "Product demo of my skincare line, studio style"</p>
            </div>
          </motion.div>
        )}

        {/* STUDIO MODE */}
        {mode === "studio" && (
          <motion.div
            key="studio"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Settings Panel */}
              <div className="lg:col-span-2 space-y-5">
                {/* Template Selection */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Film className="h-4 w-4 text-primary" />
                    Visual Style Template
                  </h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {VIDEO_PROMPT_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => setSelectedTemplate(tmpl.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          selectedTemplate === tmpl.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{tmpl.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/50 uppercase">{tmpl.category}</span>
                        </div>
                        <p className="text-xs text-foreground/40 mt-1">{tmpl.description}</p>
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
                      ? "Video includes synchronized audio. Kling generates both together."
                      : "Silent video only. Saves 33% cost."}
                  </p>
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
                {/* Selected Template Preview */}
                {selectedTemplate && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs">
                    <span className="text-primary font-medium">{getTemplateById(selectedTemplate)?.name}</span>
                    <span className="text-foreground/40"> — {getTemplateById(selectedTemplate)?.description}</span>
                  </div>
                )}

                {/* Prompt */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <h3 className="text-sm font-medium mb-3">Prompt</h3>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your video scene. The template will enhance your prompt automatically. Example: A young woman reviewing a skincare serum in her bathroom mirror, natural lighting..."
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <p className="text-xs text-foreground/30 mt-2 text-right">{prompt.length}/2500</p>

                  <button
                    onClick={handleGenerate}
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
                          <Volume2 className="h-3 w-3" /> With Audio
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
                        onClick={() => { setResult(null); setPrompt(""); }}
                        className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-surface transition-colors"
                      >
                        New
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Tips */}
                <div className="p-4 rounded-xl border border-border bg-surface">
                  <h4 className="text-sm font-medium mb-2">Template Tips</h4>
                  <ul className="space-y-1.5 text-xs text-foreground/50">
                    <li>• Each template automatically enhances your prompt with camera, lighting, and style details</li>
                    <li>• Include dialogue in quotes for talking-head content</li>
                    <li>• Describe the full scene: setting, lighting, character action, mood</li>
                    <li>• Add motion descriptions: &quot;walking toward camera&quot;, &quot;product rotating&quot;</li>
                    <li>• Kling generates audio natively — describe sound you want in the prompt</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
