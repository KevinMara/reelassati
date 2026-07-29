// ═══════════════════════════════════════════════════════════════════════════════
// OPENROUTER API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
// Unified client for: LLM (Kimi), Whisper transcription, MiniMax TTS,
// and video generation (Kling v3.0 Standard — video + native audio)
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
// VIDEO GENERATION — KLING v3.0 STANDARD (Primary)
// ═══════════════════════════════════════════════════════════════════════════════
// Video + native audio in a single pass. 720p, 3-15s, 9:16/16:9/1:1.
// Costs: $0.084/sec (silent) | $0.126/sec (with audio)
// ═══════════════════════════════════════════════════════════════════════════════

export type VideoModel = "kwaivgi/kling-v3.0-std";

export const PRIMARY_VIDEO_MODEL: VideoModel = "kwaivgi/kling-v3.0-std";

export interface VideoGenerationParams {
  prompt: string;
  duration?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  ratio?: "16:9" | "9:16" | "1:1";
  generateAudio?: boolean; // Native audio generation (default: true)
  negativePrompt?: string; // What to exclude from the video
  cfgScale?: number; // Prompt adherence 0-1 (default: 0.5)
  firstFrameUrl?: string; // Image-to-video: starting frame
  lastFrameUrl?: string; // Image-to-video: ending frame
}

export interface VideoGenerationResult {
  id: string;
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  model: string;
  hasAudio: boolean;
  cost: number; // estimated cost in USD
  error?: string;
}

export async function generateVideo(
  params: VideoGenerationParams,
): Promise<VideoGenerationResult | null> {
  try {
    const model = PRIMARY_VIDEO_MODEL;
    const duration = params.duration || 5;
    const ratio = params.ratio || "9:16";
    const generateAudio = params.generateAudio !== false;

    const input: any = {
      prompt: params.prompt,
      duration,
      ratio,
    };

    // Kling-specific passthrough parameters
    if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
    if (params.cfgScale !== undefined) input.cfg_scale = params.cfgScale;

    // Image-to-video: first frame and/or last frame
    if (params.firstFrameUrl) input.first_frame = params.firstFrameUrl;
    if (params.lastFrameUrl) input.last_frame = params.lastFrameUrl;

    const body: any = { model, input };

    // Enable native audio generation
    if (generateAudio) {
      body.input.audio = true;
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
        hasAudio: generateAudio,
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
      hasAudio: generateAudio,
      cost: estimateVideoCost(duration, generateAudio),
    };
  } catch (err: any) {
    console.error("Video generation error:", err);
    return {
      id: "",
      status: "failed",
      duration: params.duration || 5,
      model: PRIMARY_VIDEO_MODEL,
      hasAudio: params.generateAudio !== false,
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
      model: data.model || PRIMARY_VIDEO_MODEL,
      hasAudio: !!data.input?.audio,
      cost: estimateVideoCost(data.input?.duration || 5, !!data.input?.audio),
    };
  } catch {
    return null;
  }
}

function estimateVideoCost(duration: number, withAudio: boolean): number {
  // Kling v3.0 Standard pricing:
  // Without audio: $0.084/sec
  // With audio: $0.126/sec
  return duration * (withAudio ? 0.126 : 0.084);
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
    const audioRes = await fetch(audioUrl);
    const audioBlob = await audioRes.blob();

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.mp3");
    formData.append("model", "openai/whisper-large-v3-turbo");
    if (language) formData.append("language", language);

    const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
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
  voice?: string;
  speed?: number;
  emotion?: string;
  language?: string;
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
