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
  persistence: boolean;
  uploads: boolean;
  ai: boolean;
  transcription: boolean;
  speech: boolean;
  videoGeneration: boolean;
  publishing: boolean;
  missing: string[];
}

export interface WorkspaceProfile {
  email: string;
  name: string;
  workspaceName: string;
  language: "en" | "it";
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
}

export interface TimelineClip {
  id: string;
  assetId?: string;
  track: TrackKind;
  label: string;
  start: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  locked: boolean;
  muted?: boolean;
  speed?: number;
  volume?: number;
  color: string;
}

export interface TranscriptSegment {
  id: string;
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
    | "style";
  label: string;
  reason: string;
  start: number;
  end: number;
  confidence: number;
  intensity: "light" | "balanced" | "aggressive";
  targetClipIds: string[];
  status: ChangeStatus;
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
  id: string;
  label: string;
  createdAt: string;
  clips: TimelineClip[];
  transcript: TranscriptSegment[];
}

export interface EditProject {
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
  hookScore?: number;
  createdAt: string;
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
  type: "project" | "upload" | "script" | "publish" | "goal" | "generation";
  label: string;
  detail: string;
  createdAt: string;
}

export interface GenerationJob {
  id: string;
  type: "video" | "speech" | "transcription" | "edit-plan";
  status: "pending" | "in_progress" | "completed" | "failed";
  providerJobId?: string;
  projectId?: string;
  prompt?: string;
  progress: number;
  resultAssetId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDocument {
  version: 1;
  revision: number;
  profile: WorkspaceProfile;
  brandKit: BrandKit;
  projects: EditProject[];
  assets: Asset[];
  scripts: ScriptDraft[];
  accounts: PublishingAccount[];
  posts: ScheduledPost[];
  goals: Goal[];
  jobs: GenerationJob[];
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
    goals: [],
    jobs: [],
    activity: [],
    updatedAt: now,
  };
}
