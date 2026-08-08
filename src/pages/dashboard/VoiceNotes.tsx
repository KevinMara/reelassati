import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AudioLines,
  Check,
  Copy,
  FileAudio,
  FileText,
  Loader2,
  Mic,
  Save,
  Sparkles,
  Upload,
  Volume2,
} from "lucide-react";
import type {
  Asset,
  Platform,
  ScriptDraft,
  WorkspaceEvent,
} from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";
import { CONTENT_LANGUAGES } from "@/lib/languages";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import {
  withoutTextProvenanceMarker,
  type ContentProvenance,
} from "@contracts/compliance";
import { AiProvenanceBadge } from "@/components/compliance/AiProvenanceBadge";
import { copyTextWithProvenance } from "@/lib/provenance";
import { validateFileSelection } from "@/lib/file-validation";
import posthog from "@/lib/posthog";

type BusyAction = "upload" | "transcribe" | "script" | "speech" | null;

const SCRIPT_PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "linkedin", label: "LinkedIn" },
];

function createEvent(
  type: WorkspaceEvent["type"],
  label: string,
  detail: string
): WorkspaceEvent {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    detail,
    createdAt: new Date().toISOString(),
  };
}

export default function VoiceNotes() {
  const { workspace, capabilities, loading, updateWorkspace } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [sourceAsset, setSourceAsset] = useState<Asset | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [language, setLanguage] = useState(
    workspace.profile.contentLanguage || "auto"
  );
  const [transcription, setTranscription] = useState("");
  const [transcriptionProvenance, setTranscriptionProvenance] =
    useState<ContentProvenance | null>(null);
  const [segmentCount, setSegmentCount] = useState(0);
  const [scriptPlatform, setScriptPlatform] = useState<Platform>("tiktok");
  const [generatedScript, setGeneratedScript] = useState<ScriptDraft | null>(
    null
  );
  const [speechText, setSpeechText] = useState("");
  const [voiceId, setVoiceId] = useState("English_Graceful_Lady");
  const [speechAsset, setSpeechAsset] = useState<Asset | null>(null);
  const [voiceRightsConfirmed, setVoiceRightsConfirmed] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidateVoiceAttestation = () => {
    setVoiceRightsConfirmed(false);
  };

  const selectAudioFile = (nextFile: File | null) => {
    setFile(nextFile);
    setSourceAsset(null);
    setUploadProgress(0);
    setTranscription("");
    setTranscriptionProvenance(null);
    setGeneratedScript(null);
    setSpeechText("");
    setSpeechAsset(null);
    invalidateVoiceAttestation();
  };

  const acceptAudioFiles = (files: File[]) => {
    const selection = validateFileSelection(files, { purpose: "audio" });
    if (selection.error) {
      setError(selection.error);
      return;
    }
    setError(null);
    selectAudioFile(selection.files[0]);
  };

  const { isDragging, dropZoneProps } = useFileDropZone({
    disabled: !capabilities.uploads || Boolean(busyAction),
    onFiles: acceptAudioFiles,
  });

  const audioAssets = useMemo(
    () => workspace.assets.filter(asset => asset.kind === "audio"),
    [workspace.assets]
  );
  const voiceMissing = capabilities.missing.filter(item =>
    item.includes("OPENROUTER")
  );

  const saveAsset = async (asset: Asset, label: string) => {
    await updateWorkspace(current => ({
      ...current,
      assets: [
        asset,
        ...current.assets.filter(candidate => candidate.id !== asset.id),
      ],
      activity: [
        createEvent("upload", label, asset.name),
        ...current.activity,
      ].slice(0, 100),
    }));
  };

  const uploadSelectedFile = async () => {
    if (sourceAsset) return sourceAsset;
    if (!file) throw new Error("Choose an audio file first.");
    if (!capabilities.uploads)
      throw new Error("Upload storage is not configured.");

    const uploaded = await platformApi.uploadAsset(
      file,
      "audio",
      setUploadProgress
    );
    const asset = title.trim() ? { ...uploaded, name: title.trim() } : uploaded;
    setSourceAsset(asset);
    await saveAsset(asset, "Voice note uploaded");
    return asset;
  };

  const handleUpload = async () => {
    if (!file || busyAction) return;
    setBusyAction("upload");
    setError(null);
    try {
      await uploadSelectedFile();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The audio could not be uploaded."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleTranscribe = async () => {
    if ((!sourceAsset && !file) || busyAction || !capabilities.transcription)
      return;
    setBusyAction("transcribe");
    setError(null);
    setGeneratedScript(null);
    const transcriptionSource = sourceAsset ? "existing_asset" : "uploaded_file";
    try {
      const asset = await uploadSelectedFile();
      const result = await platformApi.transcribe(
        asset.id,
        language === "auto" ? undefined : language
      );
      setTranscription(result.transcript);
      setTranscriptionProvenance(result.provenance);
      setSpeechText(withoutTextProvenanceMarker(result.transcript));
      invalidateVoiceAttestation();
      setSegmentCount(result.segments.length);
      posthog?.capture("voice_note_transcribed", {
        source: transcriptionSource,
        language: language === "auto" ? "auto" : language,
        segment_count: result.segments.length,
      });
      await updateWorkspace(current => ({
        ...current,
        activity: [
          createEvent(
            "generation",
            "Voice note transcribed",
            `${asset.name} · ${result.segments.length} timestamped segments`
          ),
          ...current.activity,
        ].slice(0, 100),
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The voice note could not be transcribed."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateScript = async () => {
    if (!transcription.trim() || busyAction || !capabilities.ai) return;
    setBusyAction("script");
    setError(null);
    try {
      const result = await platformApi.generateScript({
        topic: withoutTextProvenanceMarker(transcription).trim(),
        platform: scriptPlatform,
        tone: "conversational",
        duration: 45,
        language:
          language === "auto" ? workspace.profile.contentLanguage : language,
        brandVoice: [
          workspace.brandKit.voice
            ? `Keep this brand voice: ${workspace.brandKit.voice}`
            : "",
          "Preserve the speaker's core argument and phrasing. Remove filler, not meaning.",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      setGeneratedScript(result.script);
      await updateWorkspace(current => ({
        ...current,
        scripts: [
          result.script,
          ...current.scripts.filter(
            candidate => candidate.id !== result.script.id
          ),
        ],
        activity: [
          createEvent(
            "script",
            "Voice note turned into script",
            `${result.script.title} · ${result.script.platform}`
          ),
          ...current.activity,
        ].slice(0, 100),
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The script could not be generated."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSynthesize = async () => {
    if (
      !speechText.trim() ||
      !voiceId.trim() ||
      !voiceRightsConfirmed ||
      busyAction ||
      !capabilities.speech
    ) {
      return;
    }
    setBusyAction("speech");
    setError(null);
    setSpeechAsset(null);
    try {
      const asset = await platformApi.synthesizeSpeech({
        text: speechText.trim(),
        voice: voiceId.trim(),
        projectId: workspace.projects[0]?.id,
        rightsConfirmed: voiceRightsConfirmed,
      });
      setSpeechAsset(asset);
      await saveAsset(asset, "Speech generated");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Speech could not be generated."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const copyScript = async () => {
    if (!generatedScript) return;
    try {
      await copyTextWithProvenance(
        generatedScript.fullScript,
        generatedScript.provenance
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        "Clipboard access is blocked. Select the script and copy it manually."
      );
    }
  };

  const resetSource = () => {
    setFile(null);
    setSourceAsset(null);
    setTitle("");
    setUploadProgress(0);
    setTranscription("");
    setTranscriptionProvenance(null);
    setSegmentCount(0);
    setGeneratedScript(null);
    setSpeechText("");
    setSpeechAsset(null);
    invalidateVoiceAttestation();
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">Voice Studio</p>
        <h1 className="text-3xl font-semibold">Voice to Content</h1>
        <p className="mt-2 max-w-3xl text-foreground/60">
          Upload a real audio asset, transcribe it by asset ID, shape the
          transcript into a short-form script, or synthesize a production-ready
          voice track.
        </p>
      </div>

      {!loading &&
      (!capabilities.uploads ||
        !capabilities.transcription ||
        !capabilities.speech) ? (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
          role="status"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium">Some voice tools need setup</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/55">
              Available controls stay active; unavailable provider-backed
              actions are disabled without pretending to process audio.
            </p>
            {voiceMissing.length > 0 ? (
              <p className="mt-2 font-mono text-[11px] text-amber-600 dark:text-amber-400">
                Missing: {voiceMissing.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">Source voice note</h2>
                <p
                  id="voice-source-description"
                  className="mt-1 text-xs text-foreground/45"
                >
                  The uploaded workspace asset—not a local blob URL—is sent for
                  transcription. Use Transcribe below to create its text
                  alternative.
                </p>
              </div>
              <Mic className="h-5 w-5 text-primary" />
            </div>

            <label
              className="mb-2 block text-xs font-medium"
              htmlFor="voice-title"
            >
              Working title
            </label>
            <input
              id="voice-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Launch idea — raw voice note"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={event => {
                acceptAudioFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <button
              type="button"
              {...dropZoneProps}
              onClick={() => fileInputRef.current?.click()}
              disabled={!capabilities.uploads || Boolean(busyAction)}
              className={`mt-4 flex min-h-28 w-full items-center justify-center gap-3 rounded-xl border border-dashed p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                isDragging
                  ? "scale-[1.01] border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileAudio className="h-5 w-5 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {file?.name ?? "Choose an audio file"}
                </span>
                <span className="mt-1 block text-xs text-foreground/45">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                    : isDragging
                      ? "Drop it here"
                      : "Drop audio here, or click · MP3, WAV, M4A"}
                </span>
              </span>
            </button>

            {file && !sourceAsset ? (
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={Boolean(busyAction) || !capabilities.uploads}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-medium hover:border-primary/45 disabled:opacity-45"
              >
                {busyAction === "upload" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload to workspace
                  </>
                )}
              </button>
            ) : null}

            {sourceAsset ? (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  Stored as {sourceAsset.name}
                </div>
                <audio
                  src={sourceAsset.url}
                  controls
                  preload="metadata"
                  aria-label={`Voice-note preview: ${sourceAsset.name}`}
                  aria-describedby="voice-source-description"
                  className="mt-3 w-full"
                />
              </div>
            ) : null}

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-wider text-foreground/35">
                or existing asset
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <label
              className="mb-2 block text-xs font-medium"
              htmlFor="saved-audio"
            >
              Saved audio
            </label>
            <select
              id="saved-audio"
              value={sourceAsset?.id ?? ""}
              onChange={event => {
                const asset =
                  audioAssets.find(
                    candidate => candidate.id === event.target.value
                  ) ?? null;
                setSourceAsset(asset);
                setFile(null);
                setTranscription("");
                setTranscriptionProvenance(null);
                setGeneratedScript(null);
                setSpeechText("");
                setSpeechAsset(null);
                invalidateVoiceAttestation();
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">No saved audio selected</option>
              {audioAssets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>

            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-foreground/45">
              <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
              AI transcription · Whisper via OpenRouter
            </p>
            <div className="mt-2 flex gap-2">
              <select
                aria-label="Transcription language"
                value={language}
                onChange={event => setLanguage(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              >
                {CONTENT_LANGUAGES.map(item => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleTranscribe()}
                disabled={
                  (!sourceAsset && !file) ||
                  Boolean(busyAction) ||
                  !capabilities.transcription
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyAction === "transcribe" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadProgress > 0 && uploadProgress < 100
                      ? `Uploading ${uploadProgress}%`
                      : "Transcribing"}
                  </>
                ) : (
                  <>
                    <AudioLines className="h-4 w-4" />
                    Transcribe
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">Speech synthesis</h2>
                <p className="mt-1 text-xs text-foreground/45">
                  Render approved copy into a saved audio asset.
                </p>
              </div>
              <Volume2 className="h-5 w-5 text-primary" />
            </div>
            <label
              className="mb-2 block text-xs font-medium"
              htmlFor="speech-copy"
            >
              Copy to speak
            </label>
            <textarea
              id="speech-copy"
              value={speechText}
              onChange={event => {
                if (event.target.value === speechText) return;
                setSpeechText(event.target.value);
                invalidateVoiceAttestation();
              }}
              rows={7}
              placeholder="Paste final voice-over copy or transcribe a note first."
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm leading-relaxed"
            />
            <label
              className="mb-2 mt-4 block text-xs font-medium"
              htmlFor="voice-id"
            >
              Provider voice ID
            </label>
            <input
              id="voice-id"
              value={voiceId}
              onChange={event => {
                if (event.target.value === voiceId) return;
                setVoiceId(event.target.value);
                invalidateVoiceAttestation();
              }}
              placeholder="English_Graceful_Lady"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-[11px] text-foreground/40">
              Use a voice ID supported by the configured speech provider. The
              default uses its standard voice.
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-foreground/45">
              <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
              AI-generated audio · MiniMax via OpenRouter
            </p>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-foreground/60">
              <input
                type="checkbox"
                checked={voiceRightsConfirmed}
                onChange={event =>
                  setVoiceRightsConfirmed(event.target.checked)
                }
                className="mt-0.5 accent-primary"
              />
              <span>
                I may use this text and voice. If the voice identifies a real
                person, I have documented consent or another verified legal
                basis.
              </span>
            </label>
            <button
              type="button"
              onClick={() => void handleSynthesize()}
              disabled={
                !speechText.trim() ||
                !voiceId.trim() ||
                !voiceRightsConfirmed ||
                Boolean(busyAction) ||
                !capabilities.speech
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busyAction === "speech" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Synthesizing
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate speech
                </>
              )}
            </button>

            {speechAsset ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Save className="h-3.5 w-3.5" />
                  Saved to your audio library
                </div>
                <div className="mt-2">
                  <AiProvenanceBadge provenance={speechAsset.provenance} />
                </div>
                <audio
                  src={speechAsset.url}
                  controls
                  preload="metadata"
                  aria-label={`Generated speech preview: ${speechAsset.name}`}
                  aria-describedby="generated-speech-transcript"
                  className="mt-3 w-full"
                />
                <p id="generated-speech-transcript" className="sr-only">
                  Spoken text: {speechText}
                </p>
              </motion.div>
            ) : null}
          </section>
        </div>

        <div className="space-y-5">
          <AnimatePresence mode="wait">
            {transcription ? (
              <motion.section
                key="transcript"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-surface p-6"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mono-eyebrow mb-1 text-primary">Transcript</p>
                    <h2 className="font-medium">
                      Clean the thought before writing
                    </h2>
                  </div>
                  <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[10px] text-foreground/45">
                    {segmentCount} timestamped segments
                  </span>
                </div>
                <AiProvenanceBadge
                  provenance={transcriptionProvenance || undefined}
                />
                <textarea
                  value={transcription}
                  onChange={event => {
                    setTranscription(
                      withoutTextProvenanceMarker(event.target.value)
                    );
                    setTranscriptionProvenance(null);
                    setGeneratedScript(null);
                  }}
                  rows={15}
                  aria-label="Editable transcript"
                  className="w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed"
                />
                <p className="mt-2 text-[11px] text-foreground/40">
                  Transcript edits affect the script brief. The original
                  uploaded audio asset remains unchanged.
                </p>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={scriptPlatform}
                    onChange={event =>
                      setScriptPlatform(event.target.value as Platform)
                    }
                    aria-label="Script platform"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    {SCRIPT_PLATFORMS.map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleGenerateScript()}
                    disabled={
                      !transcription.trim() ||
                      Boolean(busyAction) ||
                      !capabilities.ai
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyAction === "script" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Writing from transcript
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Turn into short-form script
                      </>
                    )}
                  </button>
                </div>
              </motion.section>
            ) : (
              <motion.section
                key="transcript-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-border bg-surface p-10 text-center"
              >
                <AudioLines className="h-9 w-9 text-primary/40" />
                <h2 className="mt-4 text-lg font-medium text-foreground/65">
                  Your transcript will stay editable
                </h2>
                <p className="mt-2 max-w-sm text-sm text-foreground/45">
                  Select a stored audio asset or upload a new one. The app waits
                  for the real transcription response before showing content.
                </p>
              </motion.section>
            )}
          </AnimatePresence>

          {generatedScript ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="mono-eyebrow mb-1 text-primary">Saved script</p>
                  <h2 className="font-medium">{generatedScript.title}</h2>
                  <p className="mt-1 text-xs text-foreground/40">
                    {generatedScript.platform} · {generatedScript.duration}s
                  </p>
                  <div className="mt-2">
                    <AiProvenanceBadge
                      provenance={generatedScript.provenance}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyScript()}
                  className="rounded-lg p-2 hover:bg-background"
                  aria-label="Copy generated script"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-primary">
                    Hook
                  </p>
                  <p className="mt-2 text-base font-semibold">
                    {generatedScript.hook}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/70">
                    {generatedScript.body}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
                    Call to action
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {generatedScript.cta}
                  </p>
                </div>
              </div>
            </motion.section>
          ) : null}

          {file || sourceAsset || transcription ? (
            <button
              type="button"
              onClick={resetSource}
              disabled={Boolean(busyAction)}
              className="w-full rounded-lg border border-border bg-surface py-2.5 text-sm font-medium transition-colors hover:border-primary/45 disabled:opacity-45"
            >
              Start a new voice note
            </button>
          ) : null}

          {error ? (
            <div
              className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
