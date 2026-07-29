import { useState, useRef } from "react";
import { Mic, Loader2, FileAudio, Sparkles, Copy, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";

export default function VoiceNotes() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<"upload" | "transcribing" | "transcribed" | "generating" | "done">("upload");
  const [transcription, setTranscription] = useState("");
  const [scripts, setScripts] = useState<any[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const transcribeMutation = trpc.voice.transcribe.useMutation({
    onSuccess: (data) => {
      setTranscription(data.text);
      setStep("transcribed");
    },
  });

  const generateMutation = trpc.voice.generateScripts.useMutation({
    onSuccess: (data) => {
      setScripts(data.scripts);
      setStep("done");
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAudioFile(f);
    setAudioUrl(URL.createObjectURL(f));
  };

  const handleTranscribe = async () => {
    if (!audioFile || !audioUrl) return;
    setStep("transcribing");
    // In production, upload to storage first, get URL
    transcribeMutation.mutate({ id: 1, audioUrl, language: "en" });
  };

  const handleGenerate = () => {
    if (!transcription) return;
    setStep("generating");
    generateMutation.mutate({ id: 1 });
  };

  const copyScript = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Voice Studio</p>
        <h1 className="text-3xl font-semibold">Voice Note to Content</h1>
        <p className="text-foreground/60 mt-2">Record your thoughts. AI transcribes and turns them into viral scripts.</p>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: UPLOAD */}
        {step === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-surface border border-border rounded-xl p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mic className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Upload a Voice Note</h3>
              <p className="text-sm text-foreground/50 mb-6">MP3, WAV, or M4A. Up to 10 minutes.</p>

              <input
                type="text"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full max-w-sm mx-auto px-4 py-2.5 rounded-lg bg-background border border-border text-sm mb-4 block"
              />

              <input ref={fileInput} type="file" accept="audio/*" className="hidden" onChange={handleFile} />

              {!audioFile ? (
                <button
                  onClick={() => fileInput.current?.click()}
                  className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors"
                >
                  Select Audio File
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 justify-center p-3 rounded-lg bg-background border border-border">
                    <FileAudio className="h-5 w-5 text-primary" />
                    <span className="text-sm">{audioFile.name}</span>
                    <span className="text-xs text-foreground/40">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <audio src={audioUrl} controls className="w-full max-w-sm mx-auto" />
                  <button
                    onClick={handleTranscribe}
                    className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Sparkles className="h-4 w-4" /> Transcribe & Generate Scripts
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* STEP 2: TRANSCRIBING */}
        {step === "transcribing" && (
          <motion.div key="transcribing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Transcribing your voice note...</p>
            <p className="text-sm text-foreground/50 mt-2">Whisper AI is listening</p>
          </motion.div>
        )}

        {/* STEP 3: TRANSCRIBED */}
        {step === "transcribed" && (
          <motion.div key="transcribed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-surface border border-border rounded-xl p-6 mb-6">
              <h3 className="text-sm font-medium text-foreground/50 mb-2 uppercase tracking-wider">Transcription</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcription}</p>
            </div>
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" /> Generate Scripts from This
            </button>
          </motion.div>
        )}

        {/* STEP 4: GENERATING */}
        {step === "generating" && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Creating viral scripts...</p>
            <p className="text-sm text-foreground/50 mt-2">Kimi is writing in your voice</p>
          </motion.div>
        )}

        {/* STEP 5: DONE */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-500">
              Generated {scripts.length} scripts from your voice note
            </div>
            <div className="space-y-4">
              {scripts.map((s: any, i: number) => (
                <div key={i} className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium uppercase">{s.platform}</span>
                    <button
                      onClick={() => copyScript(`${s.hook}\n\n${s.body}\n\n${s.cta}`, i)}
                      className="text-xs flex items-center gap-1 text-foreground/40 hover:text-primary transition-colors"
                    >
                      {copiedIndex === i ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedIndex === i ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-primary mb-1">{s.hook}</p>
                  <p className="text-sm text-foreground/70 mb-2">{s.body}</p>
                  <p className="text-sm font-medium">{s.cta}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setStep("upload"); setAudioFile(null); setTranscription(""); setScripts([]); }}
              className="mt-6 w-full py-3 border border-border rounded-lg font-medium hover:bg-surface transition-colors"
            >
              New Voice Note
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
