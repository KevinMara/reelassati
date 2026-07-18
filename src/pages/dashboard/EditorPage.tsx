import { useState } from "react";
import { Upload, Wand2, Film, Type, Music, Image, Sparkles, Layers, Zap, Scissors } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TEMPLATES = [
  { name: "Auto-Edit", desc: "AI selects best clips, adds music & captions", icon: Wand2, color: "bg-primary/10 text-primary" },
  { name: "Slideshow", desc: "Images + script with transitions", icon: Image, color: "bg-blue-500/10 text-blue-500" },
  { name: "Wall of Text", desc: "Text-heavy storytelling format", icon: Type, color: "bg-amber-500/10 text-amber-500" },
  { name: "Hook & Demo", desc: "Quick hook + product showcase", icon: Zap, color: "bg-emerald-500/10 text-emerald-500" },
  { name: "Green Screen", desc: "React to trending content", icon: Film, color: "bg-purple-500/10 text-purple-500" },
  { name: "UGC Style", desc: "Authentic testimonial format", icon: Sparkles, color: "bg-pink-500/10 text-pink-500" },
];

export default function EditorPage() {
  const [mode, setMode] = useState<"select" | "edit">("select");
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  if (mode === "select") {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p className="mono-eyebrow text-primary mb-2">Auto Editor</p>
          <h1 className="text-3xl font-semibold">AI Video Editor</h1>
          <p className="text-foreground/60 mt-2">Choose an editing mode or upload your footage</p>
        </div>

        {/* Upload Zone */}
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center mb-8 hover:border-primary/50 transition-colors cursor-pointer">
          <Upload className="h-10 w-10 mx-auto text-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">Upload your footage</h3>
          <p className="text-sm text-foreground/50 mb-4">Drag & drop videos, images, or audio files</p>
          <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">Select Files</button>
        </div>

        {/* Templates */}
        <h2 className="text-lg font-medium mb-4">Or choose a template</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((t, i) => (
            <motion.button
              key={i}
              whileHover={{ y: -2 }}
              onClick={() => { setSelectedTemplate(i); setMode("edit"); }}
              className="bg-surface border border-border rounded-xl p-5 text-left hover:shadow-card-hover transition-all"
            >
              <div className={`h-10 w-10 rounded-lg ${t.color} flex items-center justify-center mb-3`}>
                <t.icon className="h-5 w-5" />
              </div>
              <h3 className="font-medium">{t.name}</h3>
              <p className="text-sm text-foreground/50 mt-1">{t.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => setMode("select")} className="text-sm text-foreground/50 hover:text-foreground mb-2">← Back to templates</button>
          <h1 className="text-2xl font-semibold">{TEMPLATES[selectedTemplate || 0]?.name} Editor</h1>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface">Save Draft</button>
          <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover">Export</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Preview */}
        <div className="lg:col-span-2">
          <div className="aspect-video bg-black rounded-xl flex items-center justify-center relative overflow-hidden">
            <div className="text-center text-white/50">
              <Film className="h-12 w-12 mx-auto mb-3" />
              <p className="text-sm">Preview will appear here</p>
              <p className="text-xs mt-1">Upload footage to get started</p>
            </div>
            {/* Mock timeline */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-surface/90 border-t border-border flex items-center gap-1 px-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`h-8 rounded flex-1 ${i % 2 === 0 ? "bg-primary/20" : "bg-purple-500/20"}`} />
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mt-4 p-3 bg-surface border border-border rounded-xl">
            <button className="p-2 rounded-lg hover:bg-background"><Scissors className="h-4 w-4" /></button>
            <button className="p-2 rounded-lg hover:bg-background"><Type className="h-4 w-4" /></button>
            <button className="p-2 rounded-lg hover:bg-background"><Music className="h-4 w-4" /></button>
            <button className="p-2 rounded-lg hover:bg-background"><Image className="h-4 w-4" /></button>
            <button className="p-2 rounded-lg hover:bg-background"><Layers className="h-4 w-4" /></button>
            <div className="ml-auto flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-background flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Suggest
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="font-medium mb-3">AI Assistant</h3>
            <div className="space-y-2">
              <button className="w-full p-3 rounded-lg bg-background border border-border text-left text-sm hover:border-primary/50 transition-colors">
                <Sparkles className="h-3.5 w-3.5 inline mr-2 text-primary" />
                Auto-select best clips
              </button>
              <button className="w-full p-3 rounded-lg bg-background border border-border text-left text-sm hover:border-primary/50 transition-colors">
                <Type className="h-3.5 w-3.5 inline mr-2 text-primary" />
                Generate captions
              </button>
              <button className="w-full p-3 rounded-lg bg-background border border-border text-left text-sm hover:border-primary/50 transition-colors">
                <Music className="h-3.5 w-3.5 inline mr-2 text-primary" />
                Suggest background music
              </button>
              <button className="w-full p-3 rounded-lg bg-background border border-border text-left text-sm hover:border-primary/50 transition-colors">
                <Wand2 className="h-3.5 w-3.5 inline mr-2 text-primary" />
                Auto-color grade
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="font-medium mb-3">Export Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-foreground/50 mb-1">Format</label>
                <select className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
                  <option>TikTok (9:16)</option>
                  <option>Instagram Reel (9:16)</option>
                  <option>YouTube Short (9:16)</option>
                  <option>Square (1:1)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-foreground/50 mb-1">Quality</label>
                <select className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
                  <option>1080p HD</option>
                  <option>4K Ultra HD</option>
                  <option>720p</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
