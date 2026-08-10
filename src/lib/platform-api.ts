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
import type {
  ComplianceStatus,
  ContentProvenance,
  ProvenanceDetectionResult,
} from "@contracts/compliance";
import { supabase } from "@/lib/supabase/client";
import { platformApiUrl } from "@/lib/runtime";

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

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  direct = false
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(direct ? path : platformApiUrl(path), {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
      ...init?.headers,
    },
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const responseText = await response.text();
  const isJson = contentType.includes("json");
  let parsed: unknown;
  if (isJson && responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = undefined;
    }
  }

  if (!response.ok) {
    const body = (parsed ?? {}) as ApiErrorBody;
    throw new PlatformApiError(
      body.error || body.message || `Request failed (${response.status})`,
      response.status,
      body.missing
    );
  }

  if (!isJson || parsed === undefined) {
    throw new PlatformApiError(
      "The server returned an unexpected response. Reload the page and try again.",
      response.status
    );
  }

  return parsed as T;
}

async function uploadForm<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", platformApiUrl(path));
    if (data.session?.access_token) {
      request.setRequestHeader(
        "Authorization",
        `Bearer ${data.session.access_token}`
      );
    }
    request.responseType = "text";
    onProgress?.(0);

    request.upload.onprogress = event => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress?.(
        Math.max(
          0,
          Math.min(99, Math.round((event.loaded / event.total) * 100))
        )
      );
    };

    request.onerror = () => {
      reject(
        new PlatformApiError(
          "The upload could not reach the server. Check your connection and try again.",
          0
        )
      );
    };
    request.onabort = () => {
      reject(new PlatformApiError("The upload was cancelled.", 0));
    };
    request.onload = () => {
      const contentType =
        request.getResponseHeader("content-type")?.toLowerCase() ?? "";
      let body: unknown;
      if (contentType.includes("json") && request.responseText) {
        try {
          body = JSON.parse(request.responseText);
        } catch {
          body = undefined;
        }
      }
      if (request.status < 200 || request.status >= 300) {
        const errorBody = (body ?? {}) as ApiErrorBody;
        reject(
          new PlatformApiError(
            errorBody.error ||
              errorBody.message ||
              `Upload failed (${request.status || "network error"})`,
            request.status,
            errorBody.missing
          )
        );
        return;
      }
      if (body === undefined) {
        reject(
          new PlatformApiError(
            "The server returned an unexpected upload response. Reload the page and try again.",
            request.status
          )
        );
        return;
      }
      onProgress?.(100);
      resolve(body as T);
    };
    request.send(form);
  });
}

export interface SessionResponse {
  user: {
    email: string;
    name: string;
    role: "member";
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
  billingVerificationConfigured: boolean;
  referrals: ReferralClaim[];
}

export interface ProvenanceDetectionInput {
  text?: string;
  file?: File;
  token?: string;
  sha256?: string;
}

export interface SupportMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SupportTicketDraft {
  category: string;
  priority: string;
  subject: string;
  description: string;
}

export interface SupportTicketResult {
  id: string;
  emailStatus: "sent" | "failed" | "configuration_required" | string;
  supportEmail: string;
}

export interface SupportChatResponse {
  reply: string;
  resolved: boolean;
  needsHuman: boolean;
  suggestedActions: string[];
  ticketDraft: SupportTicketDraft | null;
  ticket: SupportTicketResult | null;
  supportEmail: string;
}

function supportRequestJson<T>(
  action: "chat" | "ticket",
  input: object
): Promise<T> {
  return requestJson<T>(
    "/api/support",
    {
      method: "POST",
      body: JSON.stringify({ action, ...input }),
    },
    true
  );
}

export const platformApi = {
  session: () => requestJson<SessionResponse>("/api/session"),

  capabilities: () =>
    requestJson<{ capabilities: CapabilityState }>("/api/capabilities"),

  complianceStatus: () =>
    requestJson<{ status: ComplianceStatus }>("/api/compliance/status"),

  saveOperatorCompliance: (input: {
    legalName: string;
    entityType: "individual" | "company" | "other";
    releaseStatus: "public";
    firstEuAvailabilityDate: string;
    creativeScopeConfirmed: true;
  }) =>
    requestJson<{ status: ComplianceStatus }>("/api/compliance/operator", {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  acknowledgeAiLiteracy: () =>
    requestJson<{ status: ComplianceStatus }>("/api/compliance/ai-literacy", {
      method: "POST",
      body: JSON.stringify({ acknowledged: true }),
    }),

  supportChat: (messages: SupportMessage[]) =>
    typeof window !== "undefined" &&
    !window.location.hostname.endsWith(".chatgpt.site") &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    window.location.hostname !== "terminal.local"
      ? supportRequestJson<SupportChatResponse>("chat", { messages })
      : requestJson<SupportChatResponse>("/api/support/chat", {
          method: "POST",
          body: JSON.stringify({ messages }),
        }),

  createSupportTicket: (input: SupportTicketDraft & {
    email?: string;
    name?: string;
    conversation?: SupportMessage[];
  }) =>
    typeof window !== "undefined" &&
    !window.location.hostname.endsWith(".chatgpt.site") &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    window.location.hostname !== "terminal.local"
      ? supportRequestJson<{ ticket: SupportTicketResult }>("ticket", input)
      : requestJson<{ ticket: SupportTicketResult }>("/api/support/tickets", {
          method: "POST",
          body: JSON.stringify(input),
        }),

  detectProvenance: (input: ProvenanceDetectionInput) => {
    if (input.file) {
      const form = new FormData();
      form.append("file", input.file);
      return requestJson<ProvenanceDetectionResult>("/api/provenance/detect", {
        method: "POST",
        body: form,
      });
    }
    return requestJson<ProvenanceDetectionResult>("/api/provenance/detect", {
      method: "POST",
      body: JSON.stringify({
        ...(input.text ? { text: input.text } : {}),
        ...(input.token ? { token: input.token } : {}),
        ...(input.sha256 ? { sha256: input.sha256 } : {}),
      }),
    });
  },

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

  editBrief: (projectId: string) =>
    requestJson<{ filename: string; brief: Record<string, unknown> }>(
      `/api/projects/${encodeURIComponent(projectId)}/edit-brief`
    ),

  referralStats: () => requestJson<ReferralStats>("/api/referrals"),

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
    const form = new FormData();
    form.append("file", file);
    if (kind) form.append("kind", kind);
    const response = await uploadForm<{ asset: Asset }>(
      "/api/assets",
      form,
      onProgress
    );
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
    requestJson<{
      changes: EditOperation[];
      summary: string;
      provenance: ContentProvenance;
    }>("/api/ai/edit-plan", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  analyzeVideo: (input: {
    assetId?: string;
    publicUrl?: string;
    platform: string;
    sourceRightsConfirmed: boolean;
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
      provenance: ContentProvenance;
    }>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  transcribe: (assetId: string, language?: string, projectId?: string) =>
    requestJson<{
      transcript: string;
      segments: EditProject["transcript"];
      provenance: ContentProvenance;
    }>("/api/ai/transcribe", {
      method: "POST",
      body: JSON.stringify({ assetId, language, projectId }),
    }),

  synthesizeSpeech: async (input: {
    text: string;
    voice: string;
    projectId?: string;
    rightsConfirmed: true;
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
    rightsConfirmed: true;
    referenceContainsRealPerson: boolean;
    realPersonConsentConfirmed: boolean;
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
