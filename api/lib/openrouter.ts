// ═══════════════════════════════════════════════════════════════════════════════
// OPENROUTER API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
// Unified client for: LLM (Kimi), Whisper transcription, MiniMax TTS,
// and video generation (HappyHorse, Veo)
// ═══════════════════════════════════════════════════════════════════════════════

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const API_KEY = process.env.OPENROUTER_API_KEY || "";

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.VITE_APP_URL || "https://reelassati.vercel.app",
    "X-Title": "REELassati",
  };
}

export function isConfigured(): boolean {
  return API_KEY.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export type VideoModel = "alibaba/happyhorse-1.1" | "google/veo-3.1-fast";

export interface VideoGenerationParams {
  prompt: string;
  model?: VideoModel;
  duration?: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  ratio?: "16:9" | "9:16" | "1:1" | "3:4" | "4:3";
  referenceImageUrl?: string; // For HappyHorse R2V
}

export interface VideoGenerationResult {
  id: string;
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  model: string;
  cost: number; // estimated cost in USD
  error?: string;
}

export async function generateVideo(
  params: VideoGenerationParams,
): Promise<VideoGenerationResult | null> {
  try {
    const model = params.model || "alibaba/happyhorse-1.1";
    const duration = params.duration || 5;
    const ratio = params.ratio || "9:16";

    const body: any = {
      model,
      input: {
        prompt: params.prompt,
        duration,
        ratio,
      },
    };

    // Add reference image for HappyHorse R2V feature
    if (params.referenceImageUrl && model === "alibaba/happyhorse-1.1") {
      body.input.reference_image = params.referenceImageUrl;
    }

    const res = await fetch(`${OPENROUTER_BASE}/video/generations`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("OpenRouter video error:", error);
      return {
        id: "",
        status: "failed",
        duration,
        model,
        cost: 0,
        error: `API error: ${res.status} - ${error}`,
      };
    }

    const data = await res.json();

    return {
      id: data.id || "",
      status: data.status === "completed" ? "completed" : "processing",
      videoUrl: data.output?.video_url,
      thumbnailUrl: data.output?.thumbnail_url,
      duration,
      model,
      cost: estimateVideoCost(model, duration),
    };
  } catch (err: any) {
    console.error("Video generation error:", err);
    return {
      id: "",
      status: "failed",
      duration: params.duration || 5,
      model: params.model || "alibaba/happyhorse-1.1",
      cost: 0,
      error: err.message,
    };
  }
}

export async function checkVideoStatus(
  jobId: string,
): Promise<VideoGenerationResult | null> {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/video/generations/${jobId}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      status: data.status === "completed" ? "completed" : "processing",
      videoUrl: data.output?.video_url,
      thumbnailUrl: data.output?.thumbnail_url,
      duration: data.input?.duration || 5,
      model: data.model || "",
      cost: estimateVideoCost(data.model, data.input?.duration || 5),
    };
  } catch {
    return null;
  }
}

function estimateVideoCost(model: string, duration: number): number {
  if (model.includes("happyhorse")) return duration * 0.144; // ~$0.144/sec at 1080p
  if (model.includes("veo")) return duration * 0.1; // ~$0.10/sec
  return duration * 0.12;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHISPER TRANSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function transcribeAudio(
  audioUrl: string,
  language?: string,
): Promise<{
  text: string;
  segments: { start: number; end: number; text: string }[];
} | null> {
  try {
    // Download audio and send to Whisper
    const audioRes = await fetch(audioUrl);
    const audioBlob = await audioRes.blob();

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.mp3");
    formData.append("model", "openai/whisper-large-v3-turbo");
    if (language) formData.append("language", language);

    const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      body: formData,
    });

    if (!res.ok) return null;
    const data = await res.json();

    return {
      text: data.text || "",
      segments:
        data.segments?.map((s: any) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })) || [],
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINIMAX TTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface TTSParams {
  text: string;
  voice?: string; // minimax voice preset ID
  speed?: number; // 0.5 - 2.0
  emotion?: string; // "happy", "sad", "angry", "neutral", "excited", "calm", "fearful", "disgusted"
  language?: string; // "en", "it", etc.
}

export async function synthesizeSpeech(
  params: TTSParams,
): Promise<{ audioUrl: string; duration: number } | null> {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: "minimax/speech-2.8-turbo",
        input: params.text,
        voice: params.voice || "minimax-default",
        speed: params.speed || 1.0,
        emotion: params.emotion || "neutral",
        language: params.language || "en",
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    return {
      audioUrl: data.audio_url || "",
      duration: data.duration || 0,
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM (Kimi via OpenRouter)
// ═══════════════════════════════════════════════════════════════════════════════

export async function chatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: "moonshotai/kimi-k2.5",
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}
