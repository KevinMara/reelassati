import type {
  Asset,
  CapabilityState,
  EditOperation,
  EditProject,
  GenerationJob,
  PublishingAccount,
  ScheduledPost,
  ScriptDraft,
  WorkspaceDocument,
} from "@contracts/workspace";

interface ApiErrorBody {
  error?: string;
  message?: string;
  missing?: string[];
}

export class PlatformApiError extends Error {
  status: number;
  missing: string[];

  constructor(message: string, status: number, missing: string[] = []) {
    super(message);
    this.name = "PlatformApiError";
    this.status = status;
    this.missing = missing;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new PlatformApiError(
      body.error || body.message || `Request failed (${response.status})`,
      response.status,
      body.missing
    );
  }

  return response.json() as Promise<T>;
}

export interface SessionResponse {
  user: {
    email: string;
    name: string;
    role: "owner";
  };
  capabilities: CapabilityState;
}

export interface ReferralClaim {
  id: string;
  referredDisplay: string;
  status: "pending" | "verified";
  creditsAwarded: number;
  dollarValue: string;
  qualifiedAt: string | null;
  planId: string | null;
  createdAt: string;
}

export interface ReferralStats {
  code: string;
  shareUrl: string;
  completedReferrals: number;
  pendingReferrals: number;
  creditsEarned: number;
  dollarValue: string;
  rewardCredits: number;
  rewardDollarValue: string;
  referrals: ReferralClaim[];
}

export const platformApi = {
  session: () => requestJson<SessionResponse>("/api/session"),

  capabilities: () =>
    requestJson<{ capabilities: CapabilityState }>("/api/capabilities"),

  workspace: () =>
    requestJson<{
      workspace: WorkspaceDocument;
      capabilities: CapabilityState;
    }>("/api/workspace"),

  saveWorkspace: (workspace: WorkspaceDocument) =>
    requestJson<{ workspace: WorkspaceDocument }>("/api/workspace", {
      method: "PUT",
      body: JSON.stringify({ workspace }),
    }),

  referralStats: () =>
    requestJson<ReferralStats>("/api/referrals"),

  claimReferral: (code: string) =>
    requestJson<{
      success: true;
      alreadyClaimed: boolean;
      status: "pending" | "verified";
      creditsAwarded: number;
      dollarValue: string;
    }>("/api/referrals/claim", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  uploadAsset: async (
    file: File,
    kind?: Asset["kind"],
    onProgress?: (percent: number) => void
  ): Promise<Asset> => {
    onProgress?.(5);
    const form = new FormData();
    form.append("file", file);
    if (kind) form.append("kind", kind);
    const response = await requestJson<{ asset: Asset }>("/api/assets", {
      method: "POST",
      body: form,
    });
    onProgress?.(100);
    return response.asset;
  },

  deleteAsset: (id: string) =>
    requestJson<{ ok: true }>(`/api/assets/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  generateScript: (input: {
    topic: string;
    platform: string;
    tone: string;
    duration: number;
    language: string;
    brandVoice?: string;
  }) =>
    requestJson<{ script: ScriptDraft }>("/api/ai/script", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  generateEditPlan: (input: {
    project: EditProject;
    command: string;
    selectedClipIds: string[];
    range?: { start: number; end: number };
  }) =>
    requestJson<{ changes: EditOperation[]; summary: string }>(
      "/api/ai/edit-plan",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),

  analyzeVideo: (input: {
    assetId?: string;
    publicUrl?: string;
    platform: string;
  }) =>
    requestJson<{
      summary: string;
      hook: { score: number; note: string };
      pacing: { score: number; note: string };
      retention: Array<{
        start: number;
        end: number;
        score: number;
        note: string;
      }>;
      changes: EditOperation[];
    }>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  transcribe: (assetId: string, language?: string) =>
    requestJson<{ transcript: string; segments: EditProject["transcript"] }>(
      "/api/ai/transcribe",
      {
        method: "POST",
        body: JSON.stringify({ assetId, language }),
      }
    ),

  synthesizeSpeech: async (input: {
    text: string;
    voice: string;
    projectId?: string;
  }): Promise<Asset> => {
    const result = await requestJson<{ asset: Asset }>("/api/ai/speech", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return result.asset;
  },

  createVideo: (input: {
    requestId: string;
    prompt: string;
    duration: number;
    aspectRatio: "9:16" | "16:9" | "1:1";
    resolution: "720p" | "1080p";
    generateAudio: boolean;
    firstFrameUrl?: string;
    lastFrameUrl?: string;
    projectId?: string;
  }) =>
    requestJson<{ job: GenerationJob }>("/api/video/jobs", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  videoJob: (id: string) =>
    requestJson<{ job: GenerationJob; asset?: Asset }>(
      `/api/video/jobs/${encodeURIComponent(id)}`
    ),

  publishingAccounts: () =>
    requestJson<{ accounts: PublishingAccount[]; configured: boolean }>(
      "/api/publishing/accounts"
    ),

  connectPublishingAccount: (platform: string) =>
    requestJson<{ authUrl: string }>("/api/publishing/connect", {
      method: "POST",
      body: JSON.stringify({ platform }),
    }),

  disconnectPublishingAccount: (accountId: string) =>
    requestJson<{ ok: true }>(
      `/api/publishing/accounts/${encodeURIComponent(accountId)}`,
      { method: "DELETE" }
    ),

  publish: (post: ScheduledPost, publishNow: boolean) =>
    requestJson<{
      post: ScheduledPost;
      workspace?: WorkspaceDocument;
      warning?: string;
    }>("/api/publishing/posts", {
      method: "POST",
      body: JSON.stringify({ post, publishNow }),
    }),

  reconcilePublishingStatuses: () =>
    requestJson<{
      workspace: WorkspaceDocument;
      checked: number;
      changed: number;
      warning?: string;
    }>("/api/publishing/posts/reconcile", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
