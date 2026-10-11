import type {
  AiConnectionStatus,
  ServiceDiagnostics,
  SoundEffectEnvironmentName,
} from "../contracts/service-diagnostics";

interface DiagnosticEnvironment {
  OPENROUTER_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_COMMERCIAL_ENABLED?: string;
  ELEVENLABS_SFX_USD_PER_SECOND?: string;
}

const MAX_KEY_RESPONSE_BYTES = 16 * 1024;
const AI_NOTES: Record<AiConnectionStatus, string> = {
  "not-configured": "Configure OPENROUTER_API_KEY on the server.",
  authenticated:
    "OpenRouter accepted the key. Account funding, model availability, and generated output have not been tested.",
  "key-limit-reached":
    "OpenRouter accepted the key, but its configured spending limit has no remaining allowance. Review the key limit in OpenRouter.",
  "authorization-rejected":
    "OpenRouter rejected authorization. Check the server key and its access in OpenRouter.",
  "temporarily-unavailable":
    "The connection check could not complete. Retry after checking the service and network.",
  "invalid-response":
    "OpenRouter returned an unexpected key response. Retry the connection check.",
};

async function cancelBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

async function readBoundedKeyResponse(response: Response): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_KEY_RESPONSE_BYTES) {
    await cancelBody(response);
    throw new RangeError("Key response exceeds the diagnostic bound");
  }
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_KEY_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RangeError("Key response exceeds the diagnostic bound");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

function remainingKeyLimit(payload: unknown): number | null | undefined {
  if (!payload || typeof payload !== "object" || !("data" in payload))
    return undefined;
  const data = payload.data;
  if (!data || typeof data !== "object" || !("limit_remaining" in data))
    return undefined;
  const remaining = data.limit_remaining;
  return remaining === null ||
    (typeof remaining === "number" && Number.isFinite(remaining))
    ? remaining
    : undefined;
}

/** Read-only key authentication check; never creates a generation or credit debit. */
export async function serviceDiagnostics(
  env: DiagnosticEnvironment,
  fetcher: typeof fetch = fetch
): Promise<ServiceDiagnostics> {
  const missing: SoundEffectEnvironmentName[] = [];
  if (!env.OPENROUTER_API_KEY?.trim()) missing.push("OPENROUTER_API_KEY");

  let status: AiConnectionStatus = "not-configured";
  const key = env.OPENROUTER_API_KEY?.trim();
  if (key) {
    try {
      const response = await fetcher("https://openrouter.ai/api/v1/key", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        await cancelBody(response);
        status =
          response.status === 401 || response.status === 403
            ? "authorization-rejected"
            : "temporarily-unavailable";
      } else {
        const remaining = remainingKeyLimit(
          await readBoundedKeyResponse(response)
        );
        status =
          remaining === undefined
            ? "invalid-response"
            : remaining !== null && remaining <= 0
              ? "key-limit-reached"
              : "authenticated";
      }
    } catch {
      status = "temporarily-unavailable";
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    ai: { status, note: AI_NOTES[status] },
    soundEffects: {
      configured: missing.length === 0,
      missing,
      note: missing.length
        ? "Configure the existing OpenRouter key to enable AI sound effects. The sound library remains available. No generation request was made."
        : "Sound effects use Seed Audio through the existing OpenRouter key. Credits cover measured provider output with the agreed delivery allowance; unused reserved credits are returned. Account funding, model access and generated quality have not been tested by this check.",
    },
    generationTested: false,
  };
}
