import type { ContentProvenance } from "./compliance";
import type { EditOperation } from "./workspace";
import type { StoryBeat } from "./story-beats";
import type { EditorTaskPresetId } from "./editor-chat-presets";

export const EDITOR_ASSISTANT_NAME = "Reel";
export type EditorChatMode = "ask" | "auto";
export type EditorChatScope = "requested" | "necessary" | "extra";
export type EditorChatActionStatus =
  | "pending"
  | "awaiting-approval"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "blocked"
  | "interrupted";

export type EditorChatReference =
  { assetId: string } | { name: string; text: string } | { url: string };

export interface EditorChatRequest {
  requestId: string;
  projectId: string;
  prompt: string;
  mode: EditorChatMode;
  executionMode?: "plan" | "execute";
  taskPreset?: EditorTaskPresetId;
  /** Whole-run ceiling, including this planning invocation. Never an automatic debit. */
  maxCredits: number;
  selectedClipIds?: string[];
  range?: { start: number; end: number };
  references?: EditorChatReference[];
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}

export interface EditorChatActionBase {
  id: string;
  label: string;
  reason: string;
  scope: EditorChatScope;
  /** Literal supporting excerpt from the latest user prompt. Empty for extras. */
  requestExcerpt: string;
  credits: number;
  status: EditorChatActionStatus;
  dependsOn: string[];
  error?: string;
  runtime?: {
    detail?: string;
    generationId?: string;
    jobId?: string;
    assetId?: string;
    approved?: boolean;
    result?: string;
    startedAt?: string;
    request?: EditorChatRequest;
  };
}

export type EditorChatAction = EditorChatActionBase &
  (
    | { kind: "edit"; operation: EditOperation }
    | {
        kind: "transcribe";
        assetIds: string[];
        language?: string;
        replace: boolean;
      }
    | { kind: "analyze"; assetId?: string; publicUrl?: string; focus: string }
    | {
        kind: "generate";
        media: "image" | "video" | "speech" | "music" | "sfx";
        prompt: string;
        name: string;
        seconds?: number;
        voice?: string;
        language?: string;
        /** Absent means save to Library only. */
        insert?: { start: number; duration?: number };
      }
    | {
        kind: "catalog-audio";
        catalogId: string;
        insert?: { start: number; duration: number };
      }
    | { kind: "insert"; assetId: string; start: number; duration?: number }
    | {
        kind: "settings";
        aspectRatio?: "9:16" | "16:9" | "1:1";
        duration?: number;
        captionStyle?: string;
        captionAppearance?: import("./editor-presets").CaptionAppearance;
      }
    | { kind: "history"; direction: "undo" | "redo" }
    | { kind: "seek"; time: number }
    | { kind: "replan"; prompt: string }
    | { kind: "story-beats"; beats: StoryBeat[]; splitClips?: boolean }
  );

export interface EditorChatResponse {
  assistant: "Reel";
  requestId: string;
  projectId: string;
  message: string;
  planCredits: number;
  totalCredits: number;
  maxCredits: number;
  budgetExceeded: boolean;
  actions: EditorChatAction[];
  blockedReasons: string[];
  provenance?: ContentProvenance;
  /** Identifies the server-owned snapshot the proposal was planned against. */
  projectUpdatedAt: string;
}

export interface EditorChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  requestId?: string;
  references?: EditorChatReference[];
  plan?: EditorChatResponse;
  status?:
    "planning" | "ready" | "running" | "completed" | "failed" | "stopped";
  mode?: EditorChatMode;
  maxCredits?: number;
  usedCredits?: number;
  range?: { start: number; end: number };
  selectedClipIds?: string[];
  request?: EditorChatRequest;
  /** Separate from optional-extra approvals: a plan must be explicitly applied. */
  planApproved?: boolean;
}

export interface EditorChatState {
  mode: EditorChatMode;
  maxCredits: number;
  messages: EditorChatMessage[];
  preferencesVersion?: number;
}

export function editorChatRunStatus(
  actions: EditorChatAction[],
  blockedReasons: string[],
  stopped = false
): EditorChatMessage["status"] {
  if (stopped) return "stopped";
  if (
    actions.some(a =>
      ["pending", "awaiting-approval", "interrupted", "running"].includes(
        a.status
      )
    )
  )
    return "ready";
  return blockedReasons.length ||
    actions.some(a => ["failed", "blocked"].includes(a.status))
    ? "failed"
    : "completed";
}

export function editorChatCanExecute(
  message: Pick<EditorChatMessage, "request" | "planApproved">
): boolean {
  return (
    message.request?.executionMode !== "plan" || message.planApproved === true
  );
}

/** Approval of scope is separate from authority to spend credits. */
export function editorChatNeedsApproval(
  action: EditorChatAction,
  mode: EditorChatMode
) {
  return action.scope === "extra" && mode === "ask";
}
