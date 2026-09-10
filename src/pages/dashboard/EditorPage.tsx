import { resolveMediaDuration } from "@/lib/media-metadata";
import { AssetThumbnail } from "@/components/studio/AssetThumbnail";
import { useTranslation } from "react-i18next";
import { TimelinePreview } from "@/components/studio/TimelinePreview";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AlertCircle,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleGauge,
  Copy,
  Film,
  Image as ImageIcon,
  Layers3,
  Library,
  Loader2,
  Lock,
  Maximize2,
  Mic2,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  Search,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
} from "lucide-react";
import {
  applyEditOperation,
  contentDuration,
  resizeTimeline,
  rippleRemove,
} from "@/lib/edit-timeline";
import { EditorCreationDock } from "@/components/studio/EditorCreationDock";
import { AutonomousEditor } from "@/components/studio/AutonomousEditor";
import { RenderExportPanel } from "@/components/studio/RenderExportPanel";
import { useSearchParams } from "react-router-dom";
import type {
  Asset,
  EditOperation,
  EditProject,
  EditRevision,
  QualitySignal,
  TimelineClip,
  TrackKind,
  TranscriptSegment,
} from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import type { ContentProvenance } from "@contracts/compliance";
import { AiProvenanceBadge } from "@/components/compliance/AiProvenanceBadge";
import { validateFileSelection } from "@/lib/file-validation";
import { AI_CREDIT_COSTS } from "@contracts/billing";

const PROJECT_TEMPLATES = [
  {
    name: "Blank vertical edit",
    description:
      "A clean 9:16 timeline with every decision under your control.",
    template: "blank",
    icon: Layers3,
  },
  {
    name: "Talking-head cut",
    description:
      "Dialogue-first pacing with room for captions and supporting shots.",
    template: "talking-head",
    icon: Mic2,
  },
  {
    name: "Hook and proof",
    description:
      "Structure product footage around an opening claim and visual proof.",
    template: "hook-and-proof",
    icon: WandSparkles,
  },
] as const;

const TRACKS: Array<{
  id: TrackKind;
  label: string;
  icon: typeof Film;
}> = [
  { id: "video", label: "Video", icon: Film },
  { id: "overlay", label: "Overlay", icon: ImageIcon },
  { id: "captions", label: "Captions", icon: Type },
  { id: "audio", label: "Audio", icon: Music2 },
];

const TRACK_COLORS: Record<TrackKind, string> = {
  video: "#6F5AD8",
  overlay: "#B98B4B",
  captions: "#4D8C72",
  audio: "#B45F7A",
};
const MAX_REVISIONS = 24;

function createId(prefix: string) {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.round(Math.max(0, seconds) * 10) / 10;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function snapshotProject(project: EditProject, label: string): EditRevision {
  return {
    id: createId("revision"),
    label,
    createdAt: new Date().toISOString(),
    duration: project.duration,
    clips: project.clips.map(clip => ({ ...clip })),
    transcript: project.transcript.map(segment => ({ ...segment })),
    ...(project.transcriptProvenance
      ? { transcriptProvenance: project.transcriptProvenance }
      : {}),
  };
}

function compactRevisions(revisions: EditRevision[]) {
  return revisions.slice(-MAX_REVISIONS);
}

const getProjectDuration = contentDuration;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getAssetKind(file: File): Asset["kind"] {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return "video";
}

async function readMediaDuration(file: File): Promise<number | undefined> {
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/"))
    return undefined;
  const url = URL.createObjectURL(file);
  try {
    return await resolveMediaDuration({
      name: file.name,
      kind: file.type.startsWith("audio/") ? "audio" : "video",
      url,
    } as Asset);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function deriveQualitySignals(project: EditProject): QualitySignal[] {
  const duration = Math.max(project.duration, 1);
  const visualClips = project.clips
    .filter(clip => clip.track === "video" || clip.track === "overlay")
    .sort((a, b) => a.start - b.start);
  const signals: QualitySignal[] = [];

  if (visualClips.length === 0) {
    signals.push({
      id: "preflight-no-visual",
      label: "No visual media",
      detail: "Add a video or image before preparing an export.",
      start: 0,
      end: duration,
      level: "risk",
    });
  } else {
    let coveredUntil = 0;
    visualClips.forEach(clip => {
      if (clip.start > coveredUntil + 0.15) {
        signals.push({
          id: `gap-${clip.id}`,
          label: "Visual gap",
          detail: `Nothing visual is scheduled from ${formatTime(coveredUntil)} to ${formatTime(clip.start)}.`,
          start: coveredUntil,
          end: clip.start,
          level: "risk",
        });
      }
      coveredUntil = Math.max(coveredUntil, clip.start + clip.duration);
    });
    if (coveredUntil < duration - 0.15) {
      signals.push({
        id: "gap-tail",
        label: "Empty tail",
        detail: `The timeline continues ${formatTime(duration - coveredUntil)} after the final visual.`,
        start: coveredUntil,
        end: duration,
        level: "attention",
      });
    }
  }

  if (project.transcript.length === 0) {
    signals.push({
      id: "preflight-no-transcript",
      label: "Captions not prepared",
      detail:
        "Add or transcribe dialogue, then review every line before delivery.",
      start: 0,
      end: duration,
      level: "attention",
    });
  }

  const invalidClip = project.clips.find(
    clip =>
      clip.duration <= 0 ||
      clip.inPoint < 0 ||
      clip.outPoint <= clip.inPoint ||
      clip.duration * (clip.speed ?? 1) > clip.outPoint - clip.inPoint + 0.01 ||
      clip.start < 0
  );
  if (invalidClip) {
    signals.push({
      id: "preflight-invalid-clip",
      label: "Invalid clip bounds",
      detail: `${invalidClip.label} has timing values that need review.`,
      start: invalidClip.start,
      end: invalidClip.start + Math.max(invalidClip.duration, 0.25),
      level: "risk",
    });
  }

  if (signals.length === 0) {
    signals.push({
      id: "preflight-clear",
      label: "Timeline checks clear",
      detail: "No structural gaps or invalid clip bounds were detected.",
      start: 0,
      end: duration,
      level: "good",
    });
  }

  return signals;
}

export default function EditorPage() {
  const { i18n } = useTranslation();
  const italian = i18n.resolvedLanguage?.startsWith("it");
  const {
    workspace,
    capabilities,
    loading,
    saving,
    error: workspaceError,
    updateWorkspace,
  } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"manual" | "auto">("manual");
  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<
    "inspect" | "transcript" | "assistant" | "preflight"
  >("inspect");
  const [clipDraft, setClipDraft] = useState<TimelineClip | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState<TranscriptSegment[]>(
    []
  );
  const [titleDraft, setTitleDraft] = useState("");
  const [command, setCommand] = useState("");
  const [commandSummary, setCommandSummary] = useState("");
  const [commandProvenance, setCommandProvenance] =
    useState<ContentProvenance | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [transcriptionProvenance, setTranscriptionProvenance] =
    useState<ContentProvenance | null>(null);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(5);
  const [rawPlayhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [revisionCursor, setRevisionCursor] = useState(-1);
  const [timelineZoom, setTimelineZoom] = useState(100);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryKind, setLibraryKind] = useState<
    "all" | "video" | "image" | "audio"
  >("all");
  const [recentlyAddedAssetId, setRecentlyAddedAssetId] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const project = useMemo(
    () => workspace.projects.find(item => item.id === selectedProjectId),
    [selectedProjectId, workspace.projects]
  );
  const playhead = Math.min(rawPlayhead, project?.duration ?? rawPlayhead);
  const selectedClip = useMemo(
    () => project?.clips.find(clip => clip.id === selectedClipId),
    [project?.clips, selectedClipId]
  );
  const qualitySignals = useMemo(
    () => (project ? deriveQualitySignals(project) : []),
    [project]
  );
  const previewAsset = useMemo(() => {
    const assetId = selectedClip?.assetId ?? project?.activeAssetId;
    return workspace.assets.find(asset => asset.id === assetId);
  }, [project?.activeAssetId, selectedClip?.assetId, workspace.assets]);
  const pendingAsset = useMemo(() => {
    const assetId = searchParams.get("asset");
    return assetId
      ? (workspace.assets.find(asset => asset.id === assetId) ?? null)
      : null;
  }, [searchParams, workspace.assets]);
  const filteredLibraryAssets = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    return workspace.assets.filter(asset => {
      if (
        asset.kind !== "video" &&
        asset.kind !== "image" &&
        asset.kind !== "audio"
      ) {
        return false;
      }
      if (libraryKind !== "all" && asset.kind !== libraryKind) return false;
      return !query || asset.name.toLowerCase().includes(query);
    });
  }, [libraryKind, librarySearch, workspace.assets]);
  useEffect(() => setDurationDraft(null), [project?.duration]);
  const seekTimeline = useCallback(
    (nextTime: number) => {
      const duration = project?.duration ?? 0;
      const boundedTime = clamp(nextTime, 0, duration);
      setPlayhead(boundedTime);
    },
    [project?.duration]
  );

  const openProject = (item: EditProject) => {
    const firstClip = item.clips[0] ?? null;
    setSelectedProjectId(item.id);
    setDurationDraft(null);
    setTitleDraft(item.title);
    setPlayhead(item.playhead);
    setRangeStart(item.playhead);
    setRangeEnd(Math.min(item.duration, item.playhead + 5));
    setTranscriptDraft(item.transcript.map(segment => ({ ...segment })));
    setCommandSummary("");
    setCommandProvenance(null);
    setTranscriptionProvenance(item.transcriptProvenance ?? null);
    setRevisionCursor(item.revisions.length - 1);
    setSelectedClipId(firstClip?.id ?? null);
    setClipDraft(firstClip ? { ...firstClip } : null);
  };

  useEffect(() => {
    if (!recentlyAddedAssetId) return;
    const timer = window.setTimeout(() => setRecentlyAddedAssetId(null), 1_800);
    return () => window.clearTimeout(timer);
  }, [recentlyAddedAssetId]);

  useEffect(() => {
    if (!playing || !project) return;
    const interval = window.setInterval(() => {
      setPlayhead(current => {
        const next = current + 0.1;
        if (next >= project.duration) {
          setPlaying(false);
          return project.duration;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [playing, previewAsset?.kind, project]);

  const toggleTimelinePlayback = async () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (playhead >= (project?.duration ?? 0)) seekTimeline(0);
    setPlaying(true);
  };

  const createProject = async (template: string) => {
    const now = new Date().toISOString();
    const title =
      template === "blank"
        ? "Untitled short"
        : (PROJECT_TEMPLATES.find(item => item.template === template)?.name ??
          "Untitled short");
    const base: EditProject = {
      id: createId("project"),
      title,
      template,
      status: "editing",
      platform: "tiktok",
      aspectRatio: "9:16",
      duration: 15,
      playhead: 0,
      createdAt: now,
      updatedAt: now,
      clips: [],
      transcript: [],
      proposedChanges: [],
      qualitySignals: [],
      revisions: [],
    };
    const nextProject = {
      ...base,
      revisions: [snapshotProject(base, "Project created")],
    };

    setBusyAction("create");
    setLocalError(null);
    try {
      await updateWorkspace(current => ({
        ...current,
        projects: [nextProject, ...current.projects],
        activity: [
          {
            id: createId("event"),
            type: "project",
            label: "Project created",
            detail: nextProject.title,
            createdAt: now,
          },
          ...current.activity,
        ],
      }));
      openProject(nextProject);
      return nextProject.id;
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The project could not be created."
      );
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const patchProject = async (
    patch: Partial<EditProject> | ((currentProject: EditProject) => EditProject)
  ) => {
    if (!project) return;
    return updateWorkspace(current => ({
      ...current,
      projects: current.projects.map(item => {
        if (item.id !== project.id) return item;
        const next =
          typeof patch === "function" ? patch(item) : { ...item, ...patch };
        return { ...next, updatedAt: new Date().toISOString() };
      }),
    }));
  };

  const commitProject = async (
    label: string,
    transform: (currentProject: EditProject) => EditProject
  ) => {
    if (!project) return;
    return updateWorkspace(current => ({
      ...current,
      projects: current.projects.map(item => {
        if (item.id !== project.id) return item;
        const activeCursor =
          revisionCursor >= 0
            ? Math.min(revisionCursor, item.revisions.length - 1)
            : item.revisions.length - 1;
        const history =
          item.revisions.length > 0
            ? item.revisions.slice(0, activeCursor + 1)
            : [snapshotProject(item, "Project opened")];
        const transformed = transform({
          ...item,
          clips: item.clips.map(clip => ({ ...clip })),
          transcript: item.transcript.map(segment => ({ ...segment })),
        });
        const next = {
          ...transformed,
          duration:
            transformed.duration !== item.duration
              ? transformed.duration
              : getProjectDuration(transformed.clips),
          updatedAt: new Date().toISOString(),
        };
        const revisions = compactRevisions([
          ...history,
          snapshotProject(next, label),
        ]);
        setRevisionCursor(revisions.length - 1);
        return { ...next, revisions };
      }),
    }));
  };

  const saveProjectChange = async <Result,>(
    action: () => Promise<Result>,
    fallback: string
  ): Promise<Result | undefined> => {
    setLocalError(null);
    try {
      return await action();
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : fallback);
      return undefined;
    }
  };

  const addAssetToTimeline = async (
    asset: Asset,
    targetProjectId: string,
    activityLabel: string,
    insertAt?: number
  ) => {
    asset = { ...asset, duration: await resolveMediaDuration(asset) };
    await updateWorkspace(current => {
      const target = current.projects.find(item => item.id === targetProjectId);
      if (!target) return current;
      const timelineEnd = target.clips.reduce(
        (latest, clip) => Math.max(latest, clip.start + clip.duration),
        0
      );
      const start = clamp(insertAt ?? timelineEnd, 0, target.duration);
      const duration =
        asset.duration && asset.duration > 0
          ? asset.duration
          : asset.kind === "image"
            ? 3
            : 0;
      const track: TrackKind =
        asset.kind === "audio"
          ? "audio"
          : asset.kind === "image"
            ? "overlay"
            : "video";
      const clip: TimelineClip = {
        id: createId("clip"),
        assetId: asset.id,
        track,
        label: asset.name,
        start,
        duration,
        inPoint: 0,
        outPoint: duration,
        locked: false,
        muted: false,
        speed: 1,
        volume: 1,
        color: TRACK_COLORS[track],
      };
      const clips = [...target.clips, clip];
      const updatedProject = {
        ...target,
        clips,
        activeAssetId: asset.id,
        duration: getProjectDuration(clips),
        updatedAt: new Date().toISOString(),
      };
      const revisions = compactRevisions([
        ...target.revisions,
        snapshotProject(updatedProject, `Added ${asset.name}`),
      ]);
      setRevisionCursor(revisions.length - 1);
      setSelectedClipId(clip.id);
      setClipDraft({ ...clip });

      return {
        ...current,
        assets: current.assets.some(item => item.id === asset.id)
          ? current.assets.map(item => (item.id === asset.id ? asset : item))
          : [asset, ...current.assets],
        projects: current.projects.map(item =>
          item.id === targetProjectId ? { ...updatedProject, revisions } : item
        ),
        activity: [
          {
            id: createId("event"),
            type: "project" as const,
            label: activityLabel,
            detail: asset.name,
            createdAt: new Date().toISOString(),
          },
          ...current.activity,
        ],
      };
    });
  };

  const clearPendingAsset = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("asset");
    setSearchParams(next, { replace: true });
  };

  const addPendingAssetToProject = async (target: EditProject) => {
    if (!pendingAsset) return;
    openProject(target);
    setBusyAction("library-handoff");
    setLocalError(null);
    try {
      await addAssetToTimeline(
        pendingAsset,
        target.id,
        "Library media added",
        target.playhead
      );
      setRecentlyAddedAssetId(pendingAsset.id);
      clearPendingAsset();
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The library asset could not be added."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const createProjectWithPendingAsset = async (template = "blank") => {
    if (!pendingAsset) return;
    const asset = pendingAsset;
    const projectId = await createProject(template);
    if (!projectId) return;
    setBusyAction("library-handoff");
    try {
      await addAssetToTimeline(asset, projectId, "Library media added", 0);
      setRecentlyAddedAssetId(asset.id);
      clearPendingAsset();
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The library asset could not be added."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const addLibraryAssetAtPlayhead = async (asset: Asset) => {
    if (!project) return;
    setBusyAction(`library-${asset.id}`);
    setLocalError(null);
    try {
      await addAssetToTimeline(
        asset,
        project.id,
        "Library media added",
        playhead
      );
      setRecentlyAddedAssetId(asset.id);
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The library asset could not be added."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const addUploadedFiles = async (
    files: File[],
    targetProjectId?: string | null
  ) => {
    let projectId = targetProjectId ?? selectedProjectId;
    if (!projectId) {
      projectId = await createProject("blank");
    }
    if (!projectId) return;

    setBusyAction("upload");
    setLocalError(null);
    try {
      for (const file of files) {
        const detectedDuration = await readMediaDuration(file);
        const kind = getAssetKind(file);
        const uploaded = await platformApi.uploadAsset(
          file,
          kind,
          setUploadProgress
        );
        const asset = {
          ...uploaded,
          duration: uploaded.duration ?? detectedDuration,
        };

        await addAssetToTimeline(asset, projectId, "Media uploaded and added");
      }
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The media could not be uploaded."
      );
    } finally {
      setUploadProgress(null);
      setBusyAction(null);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    acceptMediaFiles(files);
  };

  const acceptMediaFiles = (files: File[]) => {
    const selection = validateFileSelection(files, {
      multiple: true,
      purpose: "media",
    });
    if (selection.error) {
      setLocalError(selection.error);
      return;
    }
    setLocalError(null);
    void addUploadedFiles(selection.files);
  };

  const newEditDrop = useFileDropZone({
    disabled: Boolean(busyAction),
    onFiles: acceptMediaFiles,
  });
  const previewDrop = useFileDropZone({
    disabled: Boolean(busyAction),
    onFiles: acceptMediaFiles,
  });
  const timelineDrop = useFileDropZone({
    disabled: Boolean(busyAction),
    onFiles: acceptMediaFiles,
  });

  const applyClipDraft = async () => {
    if (!clipDraft || !selectedClip || selectedClip.locked) return;
    const safeStart = Math.max(0, clipDraft.start);
    const safeDuration = Math.max(0.2, clipDraft.duration);
    const safeIn = Math.max(0, clipDraft.inPoint);
    const safeOut = Math.max(safeIn + 0.2, clipDraft.outPoint);
    await saveProjectChange(
      () =>
        commitProject("Clip timing adjusted", current => ({
          ...current,
          clips: current.clips.map(clip =>
            clip.id === clipDraft.id
              ? {
                  ...clipDraft,
                  start: safeStart,
                  duration: safeDuration,
                  inPoint: safeIn,
                  outPoint: safeOut,
                }
              : clip
          ),
        })),
      "Clip timing could not be saved."
    );
  };

  const splitSelectedClip = async () => {
    if (!selectedClip || selectedClip.locked) return;
    const relativeSplit = playhead - selectedClip.start;
    if (
      relativeSplit <= 0.15 ||
      relativeSplit >= selectedClip.duration - 0.15
    ) {
      setLocalError(
        "Place the playhead inside the selected clip before splitting."
      );
      return;
    }
    const rightId = createId("clip");
    const saved = await saveProjectChange(
      () =>
        commitProject("Clip split", current => ({
          ...current,
          clips: current.clips.flatMap(clip => {
            if (clip.id !== selectedClip.id) return [clip];
            const left = {
              ...clip,
              duration: relativeSplit,
              outPoint: clip.inPoint + relativeSplit,
            };
            const right = {
              ...clip,
              id: rightId,
              label: `${clip.label} · B`,
              start: playhead,
              duration: clip.duration - relativeSplit,
              inPoint: clip.inPoint + relativeSplit,
            };
            return [left, right];
          }),
        })),
      "The clip could not be split."
    );
    if (!saved) return;
    setSelectedClipId(rightId);
    setClipDraft({
      ...selectedClip,
      id: rightId,
      label: `${selectedClip.label} · B`,
      start: playhead,
      duration: selectedClip.duration - relativeSplit,
      inPoint: selectedClip.inPoint + relativeSplit,
    });
    setLocalError(null);
  };

  const duplicateSelectedClip = async () => {
    if (!selectedClip) return;
    const duplicate = {
      ...selectedClip,
      id: createId("clip"),
      label: `${selectedClip.label} · copy`,
      start: selectedClip.start + selectedClip.duration,
      locked: false,
    };
    const saved = await saveProjectChange(
      () =>
        commitProject("Clip duplicated", current => ({
          ...current,
          clips: [...current.clips, duplicate],
        })),
      "The clip could not be duplicated."
    );
    if (!saved) return;
    setSelectedClipId(duplicate.id);
    setClipDraft({ ...duplicate });
  };

  const deleteSelectedClip = async () => {
    if (!selectedClip || selectedClip.locked) return;
    const saved = await saveProjectChange(
      () =>
        commitProject("Clip deleted", current => ({
          ...current,
          clips: current.clips.filter(clip => clip.id !== selectedClip.id),
          activeAssetId:
            current.activeAssetId === selectedClip.assetId
              ? current.clips.find(clip => clip.id !== selectedClip.id)?.assetId
              : current.activeAssetId,
        })),
      "The clip could not be deleted."
    );
    if (!saved) return;
    setSelectedClipId(null);
    setClipDraft(null);
  };

  const toggleClipProperty = async (property: "locked" | "muted") => {
    if (!selectedClip) return;
    const saved = await saveProjectChange(
      () =>
        commitProject(
          property === "locked"
            ? selectedClip.locked
              ? "Clip unlocked"
              : "Clip locked"
            : selectedClip.muted
              ? "Clip unmuted"
              : "Clip muted",
          current => ({
            ...current,
            clips: current.clips.map(clip =>
              clip.id === selectedClip.id
                ? { ...clip, [property]: !clip[property] }
                : clip
            ),
          })
        ),
      "The clip setting could not be saved."
    );
    if (!saved) return;
    setClipDraft(current =>
      current ? { ...current, [property]: !current[property] } : current
    );
  };

  const undo = async () => {
    if (!project || revisionCursor <= 0) return;
    const nextCursor = revisionCursor - 1;
    const revision = project.revisions[nextCursor];
    if (!revision) return;
    const saved = await saveProjectChange(
      () =>
        patchProject(current => ({
          ...current,
          clips: revision.clips.map(clip => ({ ...clip })),
          transcript: revision.transcript.map(segment => ({ ...segment })),
          duration: revision.duration ?? getProjectDuration(revision.clips),
        })),
      "Undo could not be saved."
    );
    if (!saved) return;
    setRevisionCursor(nextCursor);
    setTranscriptDraft(revision.transcript.map(segment => ({ ...segment })));
    setTranscriptionProvenance(revision.transcriptProvenance ?? null);
    const restoredClip = revision.clips.find(
      clip => clip.id === selectedClipId
    );
    setClipDraft(restoredClip ? { ...restoredClip } : null);
  };

  const redo = async () => {
    if (!project || revisionCursor >= project.revisions.length - 1) return;
    const nextCursor = revisionCursor + 1;
    const revision = project.revisions[nextCursor];
    if (!revision) return;
    const saved = await saveProjectChange(
      () =>
        patchProject(current => ({
          ...current,
          clips: revision.clips.map(clip => ({ ...clip })),
          transcript: revision.transcript.map(segment => ({ ...segment })),
          duration: revision.duration ?? getProjectDuration(revision.clips),
        })),
      "Redo could not be saved."
    );
    if (!saved) return;
    setRevisionCursor(nextCursor);
    setTranscriptDraft(revision.transcript.map(segment => ({ ...segment })));
    setTranscriptionProvenance(revision.transcriptProvenance ?? null);
    const restoredClip = revision.clips.find(
      clip => clip.id === selectedClipId
    );
    setClipDraft(restoredClip ? { ...restoredClip } : null);
  };

  const runEditCommand = async () => {
    if (!project || !command.trim()) return;
    setBusyAction("command");
    setCommandError(null);
    setCommandSummary("");
    setCommandProvenance(null);
    try {
      const result = await platformApi.generateEditPlan({
        project,
        command: command.trim(),
        selectedClipIds: selectedClipId ? [selectedClipId] : [],
        range: {
          start: Math.min(rangeStart, rangeEnd),
          end: Math.max(rangeStart, rangeEnd),
        },
      });
      await patchProject(current => ({
        ...current,
        proposedChanges: [
          ...current.proposedChanges.filter(
            change => change.status !== "proposed"
          ),
          ...result.changes.map(change => ({
            ...change,
            provenance: change.provenance ?? result.provenance,
          })),
        ].slice(-240),
        lastCommand: command.trim(),
      }));
      setCommandSummary(result.summary);
      setCommandProvenance(result.provenance);
    } catch (cause) {
      setCommandError(
        cause instanceof Error
          ? cause.message
          : "The edit plan could not be generated."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const acceptOperation = async (operation: EditOperation) => {
    await saveProjectChange(
      () =>
        commitProject(`Approved decision: ${operation.label}`, current =>
          applyEditOperation(current, operation)
        ),
      "The approved edit decision could not be saved."
    );
  };

  const rejectOperation = async (operation: EditOperation) => {
    await saveProjectChange(
      () =>
        patchProject(current => ({
          ...current,
          proposedChanges: current.proposedChanges.map(change =>
            change.id === operation.id
              ? {
                  ...change,
                  status: "rejected",
                  reviewedAt: new Date().toISOString(),
                }
              : change
          ),
        })),
      "The rejected edit decision could not be saved."
    );
  };

  const saveTranscript = async () => {
    const saved = await saveProjectChange(
      () =>
        commitProject("Transcript updated", current => ({
          ...current,
          transcript: transcriptDraft
            .filter(segment => segment.text.trim())
            .map(segment => ({
              ...segment,
              start: Math.max(0, segment.start),
              end: Math.max(segment.start + 0.1, segment.end),
              text: segment.text.trim(),
            })),
        })),
      "The transcript revision could not be saved."
    );
    const canonical = saved?.projects.find(
      candidate => candidate.id === project?.id
    );
    if (canonical) {
      setTranscriptDraft(canonical.transcript.map(segment => ({ ...segment })));
      setTranscriptionProvenance(canonical.transcriptProvenance ?? null);
    }
  };

  const mutateTranscript = (
    updater: (current: TranscriptSegment[]) => TranscriptSegment[]
  ) => {
    setTranscriptionProvenance(null);
    setTranscriptDraft(updater);
  };

  const transcribeActiveAsset = async () => {
    if (!previewAsset || !project) return;
    setBusyAction("transcribe");
    setLocalError(null);
    try {
      const { transcribeMedia } = await import("@/lib/transcribe-media");
      const result = await transcribeMedia(
        previewAsset,
        workspace.profile.contentLanguage,
        project.id
      );
      const sourceClips = project.clips.filter(
        c => c.assetId === previewAsset.id && !c.muted
      );
      const mapped = sourceClips.flatMap(clip =>
        result.segments
          .filter(
            segment =>
              segment.end > clip.inPoint &&
              segment.start < clip.inPoint + clip.duration * (clip.speed ?? 1)
          )
          .map(segment => ({
            ...segment,
            id: `${clip.id}-${segment.id}`,
            start:
              clip.start +
              Math.max(0, segment.start - clip.inPoint) / (clip.speed ?? 1),
            end: Math.min(
              clip.start + clip.duration,
              clip.start + (segment.end - clip.inPoint) / (clip.speed ?? 1)
            ),
          }))
      );
      setTranscriptDraft(mapped);
      setTranscriptionProvenance(result.provenance ?? null);
      const saved = await commitProject("Media transcribed", current => ({
        ...current,
        transcript: mapped,
        transcriptProvenance: result.provenance,
      }));
      const canonical = saved?.projects.find(
        candidate => candidate.id === project.id
      );
      if (canonical) {
        setTranscriptDraft(
          canonical.transcript.map(segment => ({ ...segment }))
        );
        setTranscriptionProvenance(canonical.transcriptProvenance ?? null);
      }
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The media could not be transcribed."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const addTranscriptSegment = () => {
    mutateTranscript(current => [
      ...current,
      {
        id: createId("segment"),
        start: playhead,
        end: Math.min(project?.duration ?? playhead + 2, playhead + 2),
        text: "",
      },
    ]);
  };

  const persistPlayhead = () => {
    if (project) {
      void saveProjectChange(
        () => patchProject({ playhead }),
        "The playhead position could not be saved."
      );
    }
  };

  const downloadEditBrief = async () => {
    if (!project) return;
    setBusyAction("export-brief");
    setLocalError(null);
    try {
      const payload = await platformApi.editBrief(project.id);
      const blob = new Blob([JSON.stringify(payload.brief, null, 2)], {
        type: "application/json",
      });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = payload.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The edit brief could not be prepared."
      );
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-foreground/60">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Opening your studio
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mono-eyebrow mb-2 text-primary">Editing studio</p>
            <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">
              Start with footage. Keep control of every cut.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
              Build on a real timeline, then use AI for inspectable changes you
              can accept, reject, and undo.
            </p>
          </div>
          {workspace.projects.length > 0 && (
            <span className="text-xs text-foreground/70">
              {workspace.projects.length} saved{" "}
              {workspace.projects.length === 1 ? "project" : "projects"}
            </span>
          )}
        </div>

        {(localError || workspaceError) && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{localError ?? workspaceError}</span>
          </div>
        )}

        {pendingAsset ? (
          <section className="relative mb-6 overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.06] p-5 shadow-card">
            <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex flex-wrap items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
                {pendingAsset.kind === "image" ? (
                  <ImageIcon className="h-5 w-5" />
                ) : pendingAsset.kind === "audio" ? (
                  <Music2 className="h-5 w-5" />
                ) : (
                  <Film className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="mono-eyebrow text-primary">Ready for Edit</p>
                <h2 className="mt-1 truncate font-medium">
                  {pendingAsset.name}
                </h2>
                <p className="mt-1 text-xs text-foreground/70">
                  Choose an existing project below or start a new timeline with
                  this {pendingAsset.kind} already placed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void createProjectWithPendingAsset()}
                  disabled={Boolean(busyAction)}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-45"
                >
                  {busyAction === "library-handoff"
                    ? "Adding…"
                    : "New edit with media"}
                </button>
                <button
                  type="button"
                  onClick={clearPendingAsset}
                  className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground/70 hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <button
          type="button"
          {...newEditDrop.dropZoneProps}
          onClick={() => fileInputRef.current?.click()}
          disabled={Boolean(busyAction)}
          className={`group mb-8 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-all ${
            newEditDrop.isDragging
              ? "scale-[1.005] border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
              : "border-primary/30 bg-primary/[0.035] hover:border-primary/60 hover:bg-primary/[0.06]"
          }`}
        >
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
            {busyAction === "upload" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </span>
          <span className="text-base font-medium">
            {newEditDrop.isDragging
              ? "Drop files to start the edit"
              : "Upload footage to a new edit"}
          </span>
          <span className="mt-1 text-sm text-foreground/70">
            Drop video, image, or audio here, or click to choose.
          </span>
          {uploadProgress !== null && (
            <span className="mt-4 font-mono text-xs text-primary">
              Uploading {uploadProgress}%
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,image/*,audio/*"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium">Start from a structure</h2>
          <span className="text-xs text-foreground/70">
            No irreversible auto-edit
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PROJECT_TEMPLATES.map(item => (
            <button
              key={item.template}
              type="button"
              disabled={busyAction === "create"}
              onClick={() =>
                void (pendingAsset
                  ? createProjectWithPendingAsset(item.template)
                  : createProject(item.template))
              }
              className="group rounded-2xl border border-border bg-surface p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover disabled:opacity-50"
            >
              <span className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" />
              </span>
              <span className="block font-medium">{item.name}</span>
              <span className="mt-2 block text-sm leading-5 text-foreground/70">
                {item.description}
              </span>
            </button>
          ))}
        </div>

        {workspace.projects.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-base font-medium">Saved projects</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspace.projects.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    void (pendingAsset
                      ? addPendingAssetToProject(item)
                      : openProject(item))
                  }
                  className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="mono-eyebrow shrink-0 text-foreground/70">
                      {item.aspectRatio}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-foreground/70">
                    <span>{item.clips.length} clips</span>
                    <span>{formatTime(item.duration)}</span>
                    <span className="capitalize">{item.status}</span>
                    {pendingAsset ? (
                      <span className="ml-auto font-medium text-primary">
                        Add here
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const preflightChecks = [
    {
      label: "Media on timeline",
      passed: project.clips.length > 0,
      detail:
        project.clips.length > 0
          ? `${project.clips.length} ${project.clips.length === 1 ? "clip" : "clips"} placed`
          : "Add at least one clip",
    },
    {
      label: "Valid clip bounds",
      passed: !qualitySignals.some(
        signal => signal.id === "preflight-invalid-clip"
      ),
      detail: "In/out points and durations",
    },
    {
      label: "Visual coverage",
      passed: !qualitySignals.some(
        signal =>
          signal.id === "preflight-no-visual" || signal.id.startsWith("gap-")
      ),
      detail: "No empty frames across the cut",
    },
    {
      label: "Captions reviewed",
      passed: project.transcript.length > 0,
      detail: `${project.transcript.length} transcript lines`,
    },
  ];

  return (
    <div className="min-w-0">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,image/*,audio/*"
        onChange={handleFileInput}
        className="hidden"
      />

      <header className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setSelectedProjectId(null);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground/70 hover:text-foreground"
          aria-label="Back to projects"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-[180px] flex-1">
          <input
            value={titleDraft}
            onChange={event => setTitleDraft(event.target.value)}
            onBlur={() => {
              const title = titleDraft.trim();
              if (title && title !== project.title)
                void saveProjectChange(
                  () => patchProject({ title }),
                  "The project title could not be saved."
                );
            }}
            className="w-full border-0 bg-transparent p-0 text-xl font-semibold outline-none placeholder:text-foreground/70"
            aria-label="Project title"
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/70">
            <span className="capitalize">{project.platform}</span>
            <span>·</span>
            <span>{project.aspectRatio}</span>
            <span>·</span>
            <span>{formatTime(project.duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:flex ${
              workspaceError
                ? "bg-destructive/10 text-destructive"
                : "bg-surface text-foreground/70"
            }`}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : workspaceError ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3 text-success" />
            )}
            {saving ? "Saving" : workspaceError ? "Save failed" : "Saved"}
          </span>
          <button
            type="button"
            disabled={revisionCursor <= 0}
            onClick={() => void undo()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground/70 hover:text-foreground disabled:opacity-30"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={revisionCursor >= project.revisions.length - 1}
            onClick={() => void redo()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground/70 hover:text-foreground disabled:opacity-30"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {italian ? "Esporta video" : "Export video"}
          </button>
        </div>
      </header>

      {(localError || workspaceError) && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {localError ?? workspaceError}
          </span>
          <button
            type="button"
            onClick={() => setLocalError(null)}
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex rounded-xl bg-background p-1">
          <button
            type="button"
            aria-pressed={editMode === "manual"}
            onClick={() => setEditMode("manual")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${editMode === "manual" ? "bg-primary text-primary-foreground" : "text-foreground/70"}`}
          >
            {italian ? "Montaggio manuale" : "Edit myself"}
          </button>
          <button
            type="button"
            aria-pressed={editMode === "auto"}
            onClick={() => setEditMode("auto")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${editMode === "auto" ? "bg-primary text-primary-foreground" : "text-foreground/70"}`}
          >
            {italian ? "Auto-edit AI" : "AI auto-edit"}
          </button>
        </div>
        <details className="group min-w-0 flex-1">
          <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium">
            {italian ? "Formato e durata" : "Format & duration"}
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              {italian ? "Durata video" : "Video duration"}
              <input
                aria-label="Total video duration in seconds"
                type="text"
                inputMode="decimal"
                value={durationDraft ?? project.duration.toFixed(1)}
                onChange={e => {
                  const value = e.target.value.replace(/,/g, ".");
                  if (/^\d*(\.\d?)?$/.test(value)) setDurationDraft(value);
                }}
                className="w-24 rounded-lg border border-border bg-background px-2 py-2 font-mono"
              />{" "}
              s
            </label>
            <button
              type="button"
              onClick={() =>
                void saveProjectChange(
                  () =>
                    commitProject("Video duration changed", p =>
                      resizeTimeline(
                        p,
                        durationDraft && Number(durationDraft) > 0
                          ? Number(durationDraft)
                          : p.duration
                      )
                    ),
                  "Could not change duration."
                )
              }
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              {italian ? "Imposta fine" : "Set end"}
            </button>
            <button
              type="button"
              onClick={() =>
                void saveProjectChange(
                  () =>
                    commitProject("Fitted timeline to content", p => ({
                      ...p,
                      duration: contentDuration(p.clips),
                    })),
                  "Could not fit timeline."
                )
              }
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              {italian ? "Adatta al contenuto" : "Fit to content"}
            </button>
            <select
              aria-label="Video aspect ratio"
              value={project.aspectRatio}
              onChange={e =>
                void patchProject({
                  aspectRatio: e.target.value as EditProject["aspectRatio"],
                })
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="9:16">Vertical 9:16</option>
              <option value="16:9">Landscape 16:9</option>
              <option value="1:1">Square 1:1</option>
            </select>
          </div>
        </details>
      </div>
      {editMode === "auto" && (
        <AutonomousEditor
          key={project.id}
          project={project}
          onFinished={() => {
            setEditMode("manual");
            setRevisionCursor(project.revisions.length - 1);
            setTranscriptDraft(
              project.transcript.map(segment => ({ ...segment }))
            );
            setRightPanel("inspect");
          }}
        />
      )}
      <div className="grid min-w-0 grid-cols-1 gap-5">
        <main className="min-w-0 space-y-4">
          <section
            {...previewDrop.dropZoneProps}
            className={`relative overflow-hidden rounded-2xl border bg-[#0D0C0E] shadow-card transition-all ${
              previewDrop.isDragging
                ? "border-[#A894FF] ring-4 ring-[#A894FF]/20"
                : "border-white/5"
            }`}
          >
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/60 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A894FF]" />
              {italian ? "Anteprima timeline" : "Timeline preview"}
            </div>
            <div className="relative flex min-h-[460px] items-center justify-center p-7">
              {previewDrop.isDragging ? (
                <div className="pointer-events-none absolute inset-4 z-20 flex items-center justify-center rounded-xl border border-dashed border-[#A894FF] bg-black/75 text-sm font-medium text-white backdrop-blur-sm">
                  Drop media into this edit
                </div>
              ) : null}
              <TimelinePreview
                project={project}
                assets={workspace.assets}
                time={playhead}
                playing={playing}
              />
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/30 px-4 py-2.5 text-white">
              <button
                type="button"
                onClick={() => void toggleTimelinePlayback()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/15"
                aria-label={playing ? "Pause timeline" : "Play timeline"}
              >
                {playing ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
              </button>
              <span className="w-24 font-mono text-xs text-white/65">
                {formatTime(playhead)}
              </span>
              <input
                type="range"
                min={0}
                max={project.duration}
                step={0.05}
                value={playhead}
                onChange={event => seekTimeline(Number(event.target.value))}
                onPointerUp={persistPlayhead}
                className="h-1 w-full max-w-md accent-[#8A76EA]"
                aria-label="Playhead"
              />
              <span className="w-20 text-right font-mono text-xs text-white/40">
                {formatTime(project.duration)}
              </span>
            </div>
          </section>

          <section
            {...timelineDrop.dropZoneProps}
            className={`overflow-hidden rounded-2xl border bg-surface shadow-card transition-all ${
              timelineDrop.isDragging
                ? "border-primary ring-4 ring-primary/10"
                : "border-border"
            }`}
          >
            <EditorCreationDock
              project={project}
              playhead={playhead}
              onInsert={asset =>
                addAssetToTimeline(
                  asset,
                  project.id,
                  "Created in editor",
                  playhead
                )
              }
            />
            <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
              <button
                type="button"
                onClick={() => setLibraryOpen(current => !current)}
                disabled={Boolean(busyAction)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Library className="h-3.5 w-3.5" />
                Add from library
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={Boolean(busyAction)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyAction === "upload" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload
              </button>
              <span className="hidden text-xs text-foreground/70 sm:inline">
                or drop files in this timeline
              </span>
              <span className="mx-1 h-5 w-px bg-border" />
              <button
                type="button"
                disabled={!selectedClip || selectedClip.locked}
                onClick={() => void splitSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-30"
              >
                <Scissors className="h-3.5 w-3.5" />
                Split
              </button>
              <button
                type="button"
                disabled={!selectedClip}
                onClick={() => void duplicateSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-30"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </button>
              <button
                type="button"
                disabled={!selectedClip || selectedClip.locked}
                onClick={() => void deleteSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <div className="ml-auto flex items-center gap-2 pr-1">
                {uploadProgress !== null && (
                  <span className="font-mono text-xs text-primary">
                    {uploadProgress}%
                  </span>
                )}
                <span className="text-xs text-foreground/70">Zoom</span>
                <input
                  type="range"
                  min={100}
                  max={260}
                  step={20}
                  value={timelineZoom}
                  onChange={event =>
                    setTimelineZoom(Number(event.target.value))
                  }
                  className="h-1 w-20 accent-primary"
                  aria-label="Timeline zoom"
                />
              </div>
            </div>

            {libraryOpen ? (
              <div className="m-3 rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-inner">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium">
                      Connected media library
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/70">
                      Tap any generated or uploaded asset to place it at the
                      current playhead ({formatTime(playhead)}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLibraryOpen(false)}
                    aria-label="Close media library"
                    className="rounded-md p-1.5 hover:bg-surface"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <label className="relative min-w-52 flex-1">
                    <span className="sr-only">Search connected media</span>
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/70" />
                    <input
                      type="search"
                      value={librarySearch}
                      onChange={event => setLibrarySearch(event.target.value)}
                      placeholder="Search media"
                      className="h-8 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-xs outline-none focus:border-primary/45"
                    />
                  </label>
                  <div
                    className="flex gap-1"
                    aria-label="Filter connected media"
                  >
                    {(["all", "video", "image", "audio"] as const).map(kind => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setLibraryKind(kind)}
                        aria-pressed={libraryKind === kind}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                          libraryKind === kind
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-surface text-foreground/70 hover:border-primary/35"
                        }`}
                      >
                        {kind}
                      </button>
                    ))}
                  </div>
                </div>
                {filteredLibraryAssets.length ? (
                  <div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredLibraryAssets.map(asset => {
                      const Icon =
                        asset.kind === "image"
                          ? ImageIcon
                          : asset.kind === "audio"
                            ? Music2
                            : Film;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => void addLibraryAssetAtPlayhead(asset)}
                          disabled={Boolean(busyAction)}
                          className={`group flex min-w-0 items-center gap-2 rounded-lg border bg-surface p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 disabled:opacity-45 ${
                            recentlyAddedAssetId === asset.id
                              ? "border-emerald-500/35 bg-emerald-500/[0.06]"
                              : "border-border"
                          }`}
                        >
                          <span className="flex h-14 w-20 shrink-0 overflow-hidden items-center justify-center rounded-md bg-primary/10 transition-transform group-hover:scale-105">
                            {busyAction === `library-${asset.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : recentlyAddedAssetId === asset.id ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : asset.kind === "image" ||
                              asset.kind === "video" ? (
                              <AssetThumbnail asset={asset} />
                            ) : (
                              <Icon className="h-4 w-4 text-primary" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">
                              {asset.name}
                            </span>
                            <span className="block text-xs capitalize text-foreground/70">
                              {recentlyAddedAssetId === asset.id
                                ? `Added at ${formatTime(playhead)}`
                                : `${asset.kind} · add at playhead`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-foreground/70">
                    {workspace.assets.length
                      ? "No media matches this search."
                      : "No media yet. Upload here or create video, images, and audio from Create."}
                  </p>
                )}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <div
                className="min-w-[680px]"
                style={{ width: `${timelineZoom}%` }}
              >
                <div className="grid grid-cols-[92px_minmax(0,1fr)] border-b border-border bg-background/45">
                  <div className="border-r border-border px-3 py-2 font-mono text-xs uppercase tracking-wider text-foreground/70">
                    Time
                  </div>
                  <div className="relative h-7">
                    {Array.from({
                      length: Math.floor(project.duration / 5) + 1,
                    }).map((_, index) => (
                      <span
                        key={index}
                        className="absolute top-1.5 -translate-x-1/2 font-mono text-xs text-foreground/70"
                        style={{
                          left: `${(index * 5 * 100) / project.duration}%`,
                        }}
                      >
                        {index * 5}s
                      </span>
                    ))}
                    <input
                      type="range"
                      min={0}
                      max={project.duration}
                      step={0.05}
                      value={playhead}
                      onChange={event =>
                        seekTimeline(Number(event.currentTarget.value))
                      }
                      onPointerUp={event =>
                        void saveProjectChange(
                          () =>
                            patchProject({
                              playhead: Number(event.currentTarget.value),
                            }),
                          "The playhead position could not be saved."
                        )
                      }
                      onBlur={persistPlayhead}
                      aria-label="Timeline playhead"
                      aria-valuetext={formatTime(playhead)}
                      className="absolute inset-x-2 bottom-0 z-10 h-1 w-[calc(100%_-_1rem)] cursor-col-resize accent-primary opacity-35 transition-opacity hover:opacity-100 focus:opacity-100"
                    />
                  </div>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute bottom-0 left-[92px] right-0 top-0 z-20">
                    <div
                      className="absolute bottom-0 top-0 w-px bg-primary"
                      style={{
                        left: `${(playhead / project.duration) * 100}%`,
                      }}
                    >
                      <span className="absolute -left-1.5 -top-0.5 h-3 w-3 rotate-45 rounded-[2px] bg-primary" />
                    </div>
                  </div>
                  {TRACKS.map(track => {
                    const clips = project.clips.filter(
                      clip => clip.track === track.id
                    );
                    return (
                      <div
                        key={track.id}
                        className="grid min-h-[58px] grid-cols-[92px_minmax(0,1fr)] border-b border-border last:border-b-0"
                      >
                        <div className="flex items-center gap-2 border-r border-border bg-background/35 px-3 text-xs text-foreground/70">
                          <track.icon className="h-3.5 w-3.5" />
                          {track.label}
                        </div>
                        <div className="relative m-1.5 overflow-hidden rounded-md bg-background/60">
                          {clips.map(clip => (
                            <button
                              key={clip.id}
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                setSelectedClipId(clip.id);
                                setClipDraft({ ...clip });
                                setRightPanel("inspect");
                                setPlayhead(clip.start);
                              }}
                              className={`absolute inset-y-1 overflow-hidden rounded-md border px-2 text-left text-xs font-medium text-white shadow-sm transition ${
                                selectedClipId === clip.id
                                  ? "border-white/80 ring-2 ring-primary/35"
                                  : "border-white/10 hover:border-white/40"
                              }`}
                              style={{
                                left: `${(clip.start / project.duration) * 100}%`,
                                width: `${Math.max(
                                  (clip.duration / project.duration) * 100,
                                  1.25
                                )}%`,
                                backgroundColor:
                                  clip.color || TRACK_COLORS[clip.track],
                                opacity: clip.muted ? 0.55 : 1,
                              }}
                              title={`${clip.label}, ${formatTime(clip.start)} to ${formatTime(
                                clip.start + clip.duration
                              )}`}
                            >
                              <span className="flex items-center gap-1 truncate">
                                {clip.locked && (
                                  <Lock className="h-2.5 w-2.5 shrink-0" />
                                )}
                                {clip.muted && (
                                  <VolumeX className="h-2.5 w-2.5 shrink-0" />
                                )}
                                <span className="truncate">{clip.label}</span>
                              </span>
                              <span className="mt-0.5 block truncate font-mono text-xs text-white/65">
                                {formatTime(clip.duration)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-border px-3 py-2">
              <div className="relative h-2 overflow-hidden rounded-full bg-background">
                {qualitySignals.map(signal => (
                  <span
                    key={signal.id}
                    className={`absolute inset-y-0 ${
                      signal.level === "risk"
                        ? "bg-destructive"
                        : signal.level === "attention"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{
                      left: `${(signal.start / project.duration) * 100}%`,
                      width: `${Math.max(
                        ((signal.end - signal.start) / project.duration) * 100,
                        1
                      )}%`,
                    }}
                    title={`${signal.label}: ${signal.detail}`}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-foreground/70">
                <span>Structural quality map</span>
                <button
                  type="button"
                  onClick={() => setRightPanel("preflight")}
                  className="text-primary hover:underline"
                >
                  Review {qualitySignals.length}{" "}
                  {qualitySignals.length === 1 ? "signal" : "signals"}
                </button>
              </div>
            </div>
          </section>
        </main>

        <aside className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div className="grid grid-cols-4 border-b border-border p-1.5">
            {(
              [
                ["inspect", "Clip"],
                ["transcript", "Words"],
                ["assistant", "AI plan"],
                ["preflight", "Checks"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightPanel(id)}
                className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                  rightPanel === id
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {rightPanel === "inspect" && (
              <div>
                <div className="mb-5">
                  <p className="mono-eyebrow text-primary">Clip inspector</p>
                  <h2 className="mt-2 text-lg font-medium">
                    {selectedClip ? selectedClip.label : "Select a clip"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-foreground/70">
                    Range controls change the selected clip only. Apply creates
                    a reversible revision.
                  </p>
                </div>

                {!clipDraft ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground/70">
                    Choose a block on the timeline to edit its timing.
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs text-foreground/70">
                        Clip label
                      </span>
                      <input
                        value={clipDraft.label}
                        disabled={selectedClip?.locked}
                        onChange={event =>
                          setClipDraft(current =>
                            current
                              ? { ...current, label: event.target.value }
                              : current
                          )
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
                      />
                    </label>
                    {(
                      [
                        {
                          key: "start",
                          label: "Timeline start",
                          min: 0,
                          max: Math.max(project.duration, clipDraft.start + 1),
                        },
                        {
                          key: "duration",
                          label: "Visible duration",
                          min: 0.2,
                          max: Math.max(
                            clipDraft.outPoint - clipDraft.inPoint,
                            clipDraft.duration,
                            1
                          ),
                        },
                        {
                          key: "inPoint",
                          label: "Source in",
                          min: 0,
                          max: Math.max(clipDraft.outPoint - 0.2, 0.2),
                        },
                        {
                          key: "outPoint",
                          label: "Source out",
                          min: clipDraft.inPoint + 0.2,
                          max: Math.max(
                            previewAsset?.duration ?? clipDraft.outPoint,
                            clipDraft.inPoint + 0.2
                          ),
                        },
                      ] as const
                    ).map(control => (
                      <label
                        key={control.key}
                        htmlFor={`clip-${control.key}`}
                        aria-label={control.label}
                        className="block"
                      >
                        <span className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-foreground/70">
                            {control.label}
                          </span>
                          <span className="font-mono text-foreground/70">
                            {formatTime(clipDraft[control.key])}
                          </span>
                        </span>
                        <input
                          id={`clip-${control.key}`}
                          type="range"
                          min={control.min}
                          max={control.max}
                          step={0.05}
                          value={clipDraft[control.key]}
                          disabled={selectedClip?.locked}
                          onChange={event =>
                            setClipDraft(current =>
                              current
                                ? {
                                    ...current,
                                    [control.key]: Number(event.target.value),
                                  }
                                : current
                            )
                          }
                          className="h-1 w-full accent-primary disabled:opacity-40"
                        />
                      </label>
                    ))}

                    <button
                      type="button"
                      disabled={selectedClip?.locked}
                      onClick={() => void applyClipDraft()}
                      className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
                    >
                      Apply timing
                    </button>

                    <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3">
                      <button
                        type="button"
                        disabled={selectedClip?.locked}
                        onClick={() =>
                          setClipDraft(c =>
                            c
                              ? {
                                  ...c,
                                  speed: 1,
                                  volume: 1,
                                  fadeIn: 0,
                                  fadeOut: 0,
                                  brightness: 0,
                                  contrast: 1,
                                  saturation: 1,
                                  fit: "contain",
                                }
                              : c
                          )
                        }
                        className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                      >
                        Reset look & sound
                      </button>
                      <button
                        type="button"
                        disabled={selectedClip?.locked}
                        onClick={() =>
                          setClipDraft(c =>
                            c
                              ? {
                                  ...c,
                                  volume: 0.2,
                                  fadeIn: Math.min(0.5, c.duration / 2),
                                  fadeOut: Math.min(1, c.duration / 2),
                                }
                              : c
                          )
                        }
                        className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                      >
                        Music under dialogue
                      </button>
                      <p className="self-center text-xs text-foreground/60">
                        Review the settings, then apply. Undo restores the
                        previous revision.
                      </p>
                    </div>
                    <label className="block text-sm">
                      Framing
                      <select
                        value={clipDraft.fit ?? "contain"}
                        onChange={e =>
                          setClipDraft(c =>
                            c
                              ? {
                                  ...c,
                                  fit: e.target.value as "contain" | "cover",
                                }
                              : c
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-border bg-background p-2"
                      >
                        <option value="contain">Fit whole shot</option>
                        <option value="cover">Fill frame</option>
                      </select>
                    </label>
                    {(
                      [
                        ["speed", "Playback speed", 0.25, 4, 0.05, 1],
                        ["volume", "Volume", 0, 2, 0.05, 1],
                        ["fadeIn", "Fade in (seconds)", 0, 3, 0.1, 0],
                        ["fadeOut", "Fade out (seconds)", 0, 3, 0.1, 0],
                        ["brightness", "Brightness", -0.5, 0.5, 0.05, 0],
                        ["contrast", "Contrast", 0.5, 2, 0.05, 1],
                        ["saturation", "Saturation", 0, 2, 0.05, 1],
                      ] as const
                    ).map(([key, label, min, max, step, fallback]) => (
                      <label key={key} className="block text-sm">
                        {label}{" "}
                        <span className="float-right font-mono">
                          {(clipDraft[key] ?? fallback).toFixed(1)}
                        </span>
                        <input
                          type="range"
                          aria-label={label}
                          min={min}
                          max={max}
                          step={step}
                          value={clipDraft[key] ?? fallback}
                          disabled={selectedClip?.locked}
                          onChange={e =>
                            setClipDraft(c =>
                              c ? { ...c, [key]: Number(e.target.value) } : c
                            )
                          }
                          className="mt-2 w-full accent-primary"
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      disabled={selectedClip?.locked}
                      onClick={() =>
                        void saveProjectChange(
                          () =>
                            commitProject(
                              "Clip look and sound adjusted",
                              p => ({
                                ...p,
                                clips: p.clips.map(c =>
                                  c.id === clipDraft.id
                                    ? {
                                        ...clipDraft,
                                        duration:
                                          (clipDraft.outPoint -
                                            clipDraft.inPoint) /
                                          (clipDraft.speed ?? 1),
                                      }
                                    : c
                                ),
                              })
                            ),
                          "Could not save settings."
                        )
                      }
                      className="w-full rounded-lg border border-primary px-3 py-2 text-sm text-primary"
                    >
                      Apply look and sound
                    </button>
                    <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
                      <button
                        type="button"
                        onClick={() => void toggleClipProperty("locked")}
                        className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-background"
                      >
                        {selectedClip?.locked ? (
                          <Unlock className="h-3.5 w-3.5" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        {selectedClip?.locked ? "Unlock" : "Lock"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleClipProperty("muted")}
                        className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-background"
                      >
                        {selectedClip?.muted ? (
                          <Volume2 className="h-3.5 w-3.5" />
                        ) : (
                          <VolumeX className="h-3.5 w-3.5" />
                        )}
                        {selectedClip?.muted ? "Unmute" : "Mute"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {rightPanel === "transcript" && (
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="mono-eyebrow text-primary">
                      Editable transcript
                    </p>
                    <h2 className="mt-2 text-lg font-medium">
                      Words are edit points
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={addTranscriptSegment}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-background"
                    aria-label="Add transcript line"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {capabilities.transcription && previewAsset && (
                  <button
                    type="button"
                    disabled={busyAction === "transcribe"}
                    onClick={() => void transcribeActiveAsset()}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {busyAction === "transcribe" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <AudioLines className="h-3.5 w-3.5" />
                    )}
                    Transcribe active media
                  </button>
                )}

                {transcriptionProvenance ? (
                  <div className="mb-4">
                    <AiProvenanceBadge
                      provenance={transcriptionProvenance}
                      compact
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  {transcriptDraft.map((segment, index) => (
                    <div
                      key={segment.id}
                      className="rounded-xl border border-border bg-background/55 p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={segment.start}
                          onChange={event =>
                            mutateTranscript(current =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      start: Number(event.target.value),
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-16 rounded border border-border bg-surface px-1.5 py-1 font-mono text-xs"
                          aria-label={`Line ${index + 1} start`}
                        />
                        <span className="text-xs text-foreground/70">to</span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={segment.end}
                          onChange={event =>
                            mutateTranscript(current =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, end: Number(event.target.value) }
                                  : item
                              )
                            )
                          }
                          className="w-16 rounded border border-border bg-surface px-1.5 py-1 font-mono text-xs"
                          aria-label={`Line ${index + 1} end`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            mutateTranscript(current =>
                              current.filter(item => item.id !== segment.id)
                            )
                          }
                          className="ml-auto text-foreground/70 hover:text-destructive"
                          aria-label={`Delete line ${index + 1}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <textarea
                        value={segment.text}
                        rows={2}
                        placeholder="Type the spoken line"
                        onChange={event =>
                          mutateTranscript(current =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, text: event.target.value }
                                : item
                            )
                          )
                        }
                        className="w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-foreground/70"
                      />
                    </div>
                  ))}
                </div>

                {transcriptDraft.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm leading-5 text-foreground/70">
                    Add lines manually or transcribe the selected media when the
                    speech service is connected.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void saveTranscript()}
                  className="mt-4 w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  Save transcript revision
                </button>
              </div>
            )}

            {rightPanel === "assistant" && (
              <div>
                <p className="mono-eyebrow text-primary">AI assistant</p>
                <h2 className="mt-2 text-lg font-medium">
                  Describe the change
                </h2>
                <p className="mt-1 text-xs leading-5 text-foreground/70">
                  The assistant proposes operations with a reason, confidence,
                  and exact interval. You stay in control.
                </p>

                <div className="mt-4 rounded-xl border border-border bg-background/55 p-3">
                  <textarea
                    value={command}
                    onChange={event => {
                      setCommand(event.target.value);
                      setCommandSummary("");
                      setCommandProvenance(null);
                      setCommandError(null);
                    }}
                    rows={4}
                    placeholder="Tighten the pause after the hook, keep the product reveal locked, and make the captions calmer."
                    className="w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-foreground/70"
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label>
                      <span className="mb-1 block text-xs uppercase tracking-wider text-foreground/70">
                        Range start
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={project.duration}
                        step={0.1}
                        value={rangeStart}
                        onChange={event =>
                          setRangeStart(Number(event.target.value))
                        }
                        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 font-mono text-xs"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs uppercase tracking-wider text-foreground/70">
                        Range end
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={project.duration}
                        step={0.1}
                        value={rangeEnd}
                        onChange={event =>
                          setRangeEnd(Number(event.target.value))
                        }
                        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 font-mono text-xs"
                      />
                    </label>
                  </div>
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm">
                      Selection start · {formatTime(rangeStart)}
                      <input
                        aria-label="AI selection start"
                        type="range"
                        min={0}
                        max={project.duration}
                        step={0.05}
                        value={rangeStart}
                        onChange={e => {
                          const t = Number(e.target.value);
                          setRangeStart(t);
                          seekTimeline(t);
                        }}
                        className="w-full accent-primary"
                      />
                    </label>
                    <label className="block text-sm">
                      Selection end · {formatTime(rangeEnd)}
                      <input
                        aria-label="AI selection end"
                        type="range"
                        min={0}
                        max={project.duration}
                        step={0.05}
                        value={rangeEnd}
                        onChange={e => {
                          const t = Number(e.target.value);
                          setRangeEnd(t);
                          seekTimeline(t);
                        }}
                        className="w-full accent-primary"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setRangeStart(playhead)}
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        Start at playhead
                      </button>
                      <button
                        type="button"
                        onClick={() => setRangeEnd(playhead)}
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        End at playhead
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRangeStart(0);
                          setRangeEnd(project.duration);
                        }}
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        Whole edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void saveProjectChange(
                            () =>
                              commitProject("Range removed and gap closed", p =>
                                rippleRemove(
                                  p,
                                  Math.min(rangeStart, rangeEnd),
                                  Math.max(rangeStart, rangeEnd)
                                )
                              ),
                            "Could not close gap."
                          )
                        }
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        Cut range & close gap
                      </button>
                    </div>
                  </div>
                  {selectedClip && (
                    <p className="mt-2 truncate text-xs text-foreground/70">
                      Selection: {selectedClip.label}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={
                      !capabilities.ai ||
                      !command.trim() ||
                      busyAction === "command"
                    }
                    onClick={() => void runEditCommand()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyAction === "command" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Propose changes · {AI_CREDIT_COSTS.editPlan} credits
                  </button>
                </div>

                {!capabilities.ai && (
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-foreground/60">
                    AI planning is not connected yet. Timeline editing,
                    revisions, transcript work, and edit-brief export remain
                    available.
                  </div>
                )}
                {commandError && (
                  <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
                    {commandError}
                  </div>
                )}
                {commandSummary && (
                  <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-foreground/70">
                    {commandSummary}
                    <div className="mt-2">
                      <AiProvenanceBadge
                        provenance={commandProvenance || undefined}
                        compact
                      />
                    </div>
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  {project.proposedChanges.map(change => (
                    <div
                      key={change.id}
                      className={`rounded-xl border p-3 ${
                        change.status === "accepted"
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : change.status === "rejected"
                            ? "border-border bg-background/35 opacity-55"
                            : "border-primary/20 bg-primary/[0.035]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
                          <WandSparkles className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">
                              {change.label}
                            </p>
                            <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs uppercase text-foreground/70">
                              {change.intensity}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-foreground/70">
                            {change.reason}
                          </p>
                          <div className="mt-2 flex items-center gap-3 font-mono text-xs text-foreground/70">
                            <span>
                              {formatTime(change.start)}–
                              {formatTime(change.end)}
                            </span>
                            <span>
                              {Math.round(change.confidence * 100)}% confidence
                            </span>
                          </div>
                          <div className="mt-2">
                            <AiProvenanceBadge
                              provenance={change.provenance}
                              compact
                            />
                          </div>
                        </div>
                      </div>
                      {change.status === "proposed" ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void acceptOperation(change)}
                            className="rounded-lg bg-primary px-2 py-2 text-xs font-medium text-primary-foreground"
                          >
                            Apply change
                          </button>
                          <button
                            type="button"
                            onClick={() => void rejectOperation(change)}
                            className="rounded-lg border border-border px-2 py-2 text-xs font-medium hover:bg-background"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium capitalize text-foreground/70">
                          {change.status === "accepted" ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          {change.status === "accepted"
                            ? "applied to timeline"
                            : change.status}
                        </p>
                      )}
                    </div>
                  ))}
                  {project.proposedChanges.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs leading-5 text-foreground/70">
                      No pending AI changes. Your manual timeline remains
                      untouched.
                    </p>
                  )}
                </div>
                <p className="mt-4 text-xs leading-4 text-foreground/70">
                  Apply changes to update the timeline. Undo restores the
                  previous edit.
                </p>
              </div>
            )}

            {rightPanel === "preflight" && (
              <div>
                <p className="mono-eyebrow text-primary">Preflight</p>
                <h2 className="mt-2 text-lg font-medium">
                  Know what needs attention
                </h2>
                <p className="mt-1 text-xs leading-5 text-foreground/70">
                  These are structural checks from the current timeline, not
                  invented performance predictions.
                </p>

                <div className="mt-5 space-y-2">
                  {preflightChecks.map(check => (
                    <div
                      key={check.label}
                      className="flex items-start gap-3 rounded-xl border border-border bg-background/45 p-3"
                    >
                      {check.passed ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <div>
                        <p className="text-xs font-medium">{check.label}</p>
                        <p className="mt-0.5 text-xs text-foreground/70">
                          {check.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium">
                      Timeline signals
                    </span>
                    <CircleGauge className="h-4 w-4 text-foreground/70" />
                  </div>
                  <div className="space-y-2">
                    {qualitySignals.map(signal => (
                      <button
                        key={signal.id}
                        type="button"
                        onClick={() => {
                          setPlayhead(signal.start);
                          setRangeStart(signal.start);
                          setRangeEnd(signal.end);
                        }}
                        className="w-full rounded-xl border border-border p-3 text-left hover:bg-background/60"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {signal.label}
                          </span>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              signal.level === "risk"
                                ? "bg-destructive"
                                : signal.level === "attention"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                          />
                        </div>
                        <p className="mt-1 text-xs leading-4 text-foreground/70">
                          {signal.detail}
                        </p>
                        <p className="mt-2 font-mono text-xs text-foreground/70">
                          {formatTime(signal.start)}–{formatTime(signal.end)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {exportOpen && (
        <RenderExportPanel
          project={project}
          onClose={() => setExportOpen(false)}
          onBrief={() => void downloadEditBrief()}
        />
      )}
    </div>
  );
}
