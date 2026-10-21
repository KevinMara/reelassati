import type {
  ContentProvenance,
  PublicationComplianceReview,
} from "./compliance";
import type { InterfaceLanguage } from "./interface-language";

export type Platform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "twitter"
  | "facebook"
  | "linkedin"
  | "pinterest"
  | "threads";

export type ProjectStatus =
  "draft" | "editing" | "review" | "scheduled" | "published";

export type AssetKind = "video" | "audio" | "image" | "script" | "export";
export type TrackKind = "video" | "audio" | "captions" | "overlay";
export type ChangeStatus = "proposed" | "accepted" | "rejected";

export interface CapabilityState {
  operations?: boolean;
  persistence: boolean;
  uploads: boolean;
  ai: boolean;
  analysis: boolean;
  /** Paid analysis requires a matching complete audiovisual response contract. */
  analysisSchemaVersion?: string;
  analysisTransportVersion?: "foreground-v1";
  transcription: boolean;
  speech: boolean;
  musicGeneration?: boolean;
  soundGeneration?: boolean;
  imageGeneration: boolean;
  videoGeneration: boolean;
  publishing: boolean;
  /** Versioned rollout: older backends do not accept the automatic composer. */
  publicationComposer?: boolean;
  missing: string[];
  modelRoutes: Array<{
    purpose:
      "Text" | "Analysis" | "Transcription" | "Speech" | "Image" | "Video";
  }>;
}

export interface WorkspaceProfile {
  email: string;
  name: string;
  workspaceName: string;
  language: InterfaceLanguage;
  contentLanguage: string;
  timezone: string;
  credits: number;
}

export interface BrandKit {
  name: string;
  voice: string;
  audience: string;
  primaryColor: string;
  accentColor: string;
  captionPreset: "kinetic" | "editorial" | "minimal";
  font: string;
  safeZone: number;
  audioDucking: number;
  scenePresets?: Array<{
    id: string;
    name: string;
    direction: Record<string, string>;
  }>;
}

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  contentType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  url: string;
  status: "ready" | "processing" | "failed";
  createdAt: string;
  variantGroupId?: string;
  parentAssetId?: string;
  favorite?: boolean;
  folderId?: string;
  projectId?: string;
  provenance?: ContentProvenance;
}

export interface TimelineClip {
  visual?: import("./clip-visual").ClipVisual;
  /** Source clock retained across trims, splits, and speed changes. */
  visualStart?: number;
  visualDuration?: number;
  graphic?: import("./motion-graphics").MotionGraphic;
  /** Original animation span, preserved when a graphic is cut or trimmed. */
  graphicDuration?: number;
  id: string;
  assetId?: string;
  track: TrackKind;
  /** Persistent selection group. Independent of an audio/video source link. */
  groupId?: string;
  /** Explicitly linked, aligned audio/video members; copies use fresh links. */
  linkId?: string;
  /** One-based lane within the visual, audio, text or graphic track family. */
  lane?: number;
  /** Preserve primary-story identity when a transition raises the visual lane. */
  primaryFootage?: boolean;
  /** Silent visual source handle; excluded from speech and story evidence. */
  transitionHandle?: boolean;
  /** Reversible generated transition; timing edits require removing it first. */
  shotTransition?: {
    outgoingId: string;
    incomingId: string;
    incomingEntrance: import("./clip-visual").ClipVisual["entrance"];
    outgoingExit: import("./clip-visual").ClipVisual["exit"];
  };
  label: string;
  start: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  locked: boolean;
  muted?: boolean;
  /** Hide picture/graphics while retaining source audio. */
  hidden?: boolean;
  speed?: number;
  volume?: number;
  audioMix?: import("./audio-mix").ClipAudioMix;
  color: string;
  fit?: "contain" | "cover";
  fadeIn?: number;
  fadeOut?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}
export interface TranscriptSegment {
  words?: TranscriptWord[];
  id: string;
  sourceClipId?: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  emphasis?: boolean;
}

export interface EditOperation {
  id: string;
  type:
    | "trim"
    | "split"
    | "move"
    | "delete"
    | "caption"
    | "silence"
    | "pacing"
    | "broll"
    | "audio"
    | "style"
    | "graphic";
  label: string;
  reason: string;
  start: number;
  end: number;
  confidence: number;
  intensity: "light" | "balanced" | "aggressive";
  targetClipIds: string[];
  status: ChangeStatus;
  provenance?: ContentProvenance;
  reviewedAt?: string;
  parameters?: {
    visual?: Partial<import("./clip-visual").ClipVisual>;
    graphicMode?: "create" | "update";
    graphic?: import("./motion-graphics").MotionGraphic;
    sourceIn?: number;
    /** Exact caption owner, used when projecting analyzed source clocks onto a timeline occurrence. */
    sourceClipId?: string;
    destination?: number;
    speed?: number;
    volume?: number;
    text?: string;
    assetId?: string;
    prompt?: string;
    mediaKind?: "image" | "video";
    fit?: "contain" | "cover";
    fadeIn?: number;
    fadeOut?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
  };
}

export interface QualitySignal {
  id: string;
  label: string;
  detail: string;
  start: number;
  end: number;
  level: "good" | "attention" | "risk";
}

export interface EditRevision {
  frameRate?: import("./export-settings").ExportFrameRate;
  trackSettings?: import("./timeline-mixer").TimelineTrackSettings[];
  storyBeats?: import("./story-beats").StoryBeat[];
  aspectRatio?: EditProject["aspectRatio"];
  captionStyle?: string;
  captionAppearance?: import("./editor-presets").CaptionAppearance;
  id: string;
  label: string;
  createdAt: string;
  duration?: number;
  clips: TimelineClip[];
  transcript: TranscriptSegment[];
  /** Server-rehydrated provenance for the exact transcript snapshot. */
  transcriptProvenance?: ContentProvenance;
}

export interface EditProject {
  frameRate?: import("./export-settings").ExportFrameRate;
  trackSettings?: import("./timeline-mixer").TimelineTrackSettings[];
  storyBeats?: import("./story-beats").StoryBeat[];
  editorChat?: import("./editor-chat").EditorChatState;
  /** Selected revision; preserves undo/redo after navigation and batched imports. */
  revisionIndex?: number;
  /** Caption preset shared by the scrubbed preview and exported subtitles. */
  captionStyle?: string;
  captionAppearance?: import("./editor-presets").CaptionAppearance;
  sourceReviews?: import("./source-review").SourceReview[];
  referenceStyleBrief?: string;
  id: string;
  title: string;
  template: string;
  status: ProjectStatus;
  platform: Platform;
  aspectRatio: "9:16" | "1:1" | "16:9";
  duration: number;
  playhead: number;
  createdAt: string;
  updatedAt: string;
  clips: TimelineClip[];
  transcript: TranscriptSegment[];
  /**
   * Server-owned provenance for the exact transcript segment projection.
   * Browser workspace JSON is only a projection and is reconciled on save/load.
   */
  transcriptProvenance?: ContentProvenance;
  proposedChanges: EditOperation[];
  qualitySignals: QualitySignal[];
  revisions: EditRevision[];
  activeAssetId?: string;
  lastCommand?: string;
}

export interface ScriptDraft {
  id: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  fullScript: string;
  platform: Platform;
  tone: string;
  duration: number;
  language: string;
  writingPack?: import("./script-writing-pack").ScriptWritingPack;
  hookScore?: number;
  createdAt: string;
  provenance?: ContentProvenance;
}

export interface PublishingAccount {
  id: string;
  providerId: string;
  platform: Platform;
  accountName: string;
  handle?: string;
  status: "connected" | "expired" | "disconnected";
}

export interface ScheduledPost {
  id: string;
  caption: string;
  /** Exact disclosure/hashtag/provenance-bearing payload sent to the provider. */
  outgoingContent?: string;
  hashtags: string[];
  mediaAssetId?: string;
  accountIds: string[];
  platforms: Platform[];
  scheduledAt?: string;
  publishedAt?: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  providerPostId?: string;
  providerStatus?: string;
  statusCheckedAt?: string;
  publishedUrls?: string[];
  failureReason?: string;
  createdAt: string;
  complianceReview?: PublicationComplianceReview;
}

export type CalendarEventKind =
  "task" | "shoot" | "meeting" | "deadline" | "other";

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string;
  date: string;
  startTime?: string;
  endTime?: string;
  kind: CalendarEventKind;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  label: string;
  metric: "followers" | "posts" | "engagement" | "views";
  current: number;
  target: number;
  deadline?: string;
  platform?: Platform;
  createdAt: string;
}

export interface WorkspaceEvent {
  id: string;
  type:
    | "project"
    | "upload"
    | "script"
    | "publish"
    | "goal"
    | "generation"
    | "calendar";
  label: string;
  detail: string;
  createdAt: string;
}

export interface GenerationJob {
  id: string;
  type: "video" | "speech" | "transcription" | "edit-plan";
  status: "pending" | "in_progress" | "completed" | "failed";
  projectId?: string;
  prompt?: string;
  progress: number;
  resultAssetId?: string;
  /** Existing provider output can be downloaded again without a new generation. */
  canRecover?: boolean;
  error?: string;
  createdAt: string;
  updatedAt: string;
  provenance?: ContentProvenance;
  continuity?: {
    mode: "new" | "continue";
    rootJobId: string;
    parentJobId?: string;
    sourceAssetId?: string;
  };
}

export interface WorkspaceDocument {
  editorStyles?: import("./editor-style-library").EditorSavedStyle[];
  version: 1;
  revision: number;
  profile: WorkspaceProfile;
  brandKit: BrandKit;
  projects: EditProject[];
  assets: Asset[];
  mediaFolders?: Array<{ id: string; name: string; parentId?: string }>;
  scripts: ScriptDraft[];
  accounts: PublishingAccount[];
  posts: ScheduledPost[];
  calendarEvents: CalendarEvent[];
  goals: Goal[];
  jobs: GenerationJob[];
  editorGenerations?: import("./editor-generations").EditorGeneration[];
  activity: WorkspaceEvent[];
  updatedAt: string;
}

export function createEmptyWorkspace(
  email: string,
  name = "Creator"
): WorkspaceDocument {
  const now = new Date().toISOString();
  return {
    version: 1,
    revision: 0,
    profile: {
      email,
      name,
      workspaceName: "My studio",
      language: "en",
      contentLanguage: "en",
      timezone: "Europe/Rome",
      credits: 0,
    },
    brandKit: {
      name: "Default brand",
      voice: "",
      audience: "",
      primaryColor: "#6F5AD8",
      accentColor: "#D8FF4F",
      captionPreset: "kinetic",
      font: "Geist",
      safeZone: 12,
      audioDucking: 35,
    },
    projects: [],
    assets: [],
    scripts: [],
    accounts: [],
    posts: [],
    calendarEvents: [],
    goals: [],
    jobs: [],
    activity: [],
    updatedAt: now,
  };
}
