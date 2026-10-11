export type AiConnectionStatus =
  | "not-configured"
  | "authenticated"
  | "key-limit-reached"
  | "authorization-rejected"
  | "temporarily-unavailable"
  | "invalid-response";

export type SoundEffectEnvironmentName =
  | "OPENROUTER_API_KEY"
  | "ELEVENLABS_API_KEY"
  | "ELEVENLABS_COMMERCIAL_ENABLED"
  | "ELEVENLABS_SFX_USD_PER_SECOND";

export interface ServiceDiagnostics {
  checkedAt: string;
  ai: { status: AiConnectionStatus; note: string };
  soundEffects: {
    configured: boolean;
    missing: SoundEffectEnvironmentName[];
    note: string;
  };
  generationTested: false;
}
