import {
  appendEditorRevisions,
  currentRevisionIndex,
  restoreEditorRevision,
} from "@/lib/editor-history";
import { CompactSelect } from "@/components/ui/compact-select";
import { CaptionAppearanceEditor } from "@/components/studio/CaptionAppearanceEditor";
import {
  captionIssues,
  splitCaption,
  mergeCaptions,
} from "@/lib/caption-editing";
import { CaptionFileTools } from "@/components/studio/CaptionFileTools";
import { ClipInspector } from "@/components/studio/ClipInspector";
import { EditorInfo } from "@/components/studio/EditorInfo";
import { EditorShortcuts } from "@/components/studio/EditorShortcuts";
import {
  replaceTimelineClip,
  detachClipAudio,
  moveClipGroup,
  deleteClipGroup,
  pasteClipGroup,
} from "@/lib/editor-manual";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { resolveMediaDuration } from "@/lib/media-metadata";
import { useTranslation } from "react-i18next";
import { EditorPresetLibrary } from "@/components/studio/EditorPresetLibrary";
import {
  buildStoryBeatEvidence,
  storyBeatsAreCurrent,
} from "@contracts/story-beats";
import { StoryBeatStrip } from "@/components/studio/StoryBeatStrip";
import { TimelineTracks } from "@/components/studio/TimelineTracks";
import {
  allocateTimelineLane,
  clipLaneKind,
  trimTimelineClip,
  normalizeClipTiming,
  preserveGraphicDuration,
  type TimelineLane,
} from "@/lib/timeline-lanes";
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
  ChevronLeft,
  Copy,
  Film,
  Image as ImageIcon,
  Layers3,
  Library,
  Loader2,
  Maximize2,
  Mic2,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  Keyboard,
  ZoomIn,
  Sparkles,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  applyEditOperation,
  contentDuration,
  resizeTimeline,
} from "@/lib/edit-timeline";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EditorChat } from "@/components/studio/EditorChat";
import {
  EditorCreationDock,
  type DockKind,
} from "@/components/studio/EditorCreationDock";
import { TimelinePrompt } from "@/components/studio/TimelinePrompt";
import { AutonomousEditor } from "@/components/studio/AutonomousEditor";
import { RenderExportPanel } from "@/components/studio/RenderExportPanel";
import { useSearchParams } from "react-router-dom";
import type {
  Asset,
  EditProject,
  EditRevision,
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

const TRACK_COLORS: Record<TrackKind, string> = {
  video: "#6F5AD8",
  overlay: "#B98B4B",
  captions: "#4D8C72",
  audio: "#B45F7A",
};

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
    captionStyle: project.captionStyle,
    captionAppearance: project.captionAppearance,
    aspectRatio: project.aspectRatio,
    storyBeats: project.storyBeats,
    clips: project.clips.map(clip => ({ ...clip })),
    transcript: project.transcript.map(segment => ({ ...segment })),
    ...(project.transcriptProvenance
      ? { transcriptProvenance: project.transcriptProvenance }
      : {}),
  };
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
  const [extraSelection, setExtraSelection] = useState<string[]>([]);
  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  const [leftTool, setLeftTool] = useState<DockKind>("library");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [snapping, setSnapping] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const previewDrag = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const [autoEditOpen, setAutoEditOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<{
    text: string;
    id: number;
    range?: { start: number; end: number };
  }>();
  const [clipDraft, setClipDraft] = useState<TimelineClip | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState<TranscriptSegment[]>(
    []
  );
  const captionCursors = useRef<Record<string, number>>({});
  const transcriptBase = useRef<{ projectId: string; value: string } | null>(
    null
  );
  const [transcriptConflict, setTranscriptConflict] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [transcriptionProvenance, setTranscriptionProvenance] =
    useState<ContentProvenance | null>(null);
  const [rawPlayhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(100);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [recentlyAddedAssetId, setRecentlyAddedAssetId] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipboardRef = useRef<TimelineClip[]>([]);
  const clipboardTranscript = useRef<TranscriptSegment[]>([]);
  const keyboardActionPending = useRef(false);

  const project = useMemo(
    () => workspace.projects.find(item => item.id === selectedProjectId),
    [selectedProjectId, workspace.projects]
  );
  useEffect(() => {
    if (!project) return;
    const next = JSON.stringify(project.transcript);
    const previous = transcriptBase.current;
    if (
      !previous ||
      previous.projectId !== project.id ||
      previous.value === JSON.stringify(transcriptDraft) ||
      next === JSON.stringify(transcriptDraft)
    ) {
      setTranscriptDraft(project.transcript.map(segment => ({ ...segment })));
      setTranscriptionProvenance(project.transcriptProvenance ?? null);
      transcriptBase.current = { projectId: project.id, value: next };
      setTranscriptConflict(false);
    } else if (previous.value !== next) setTranscriptConflict(true);
    // Draft keystrokes should not trigger synchronization from the saved transcript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.transcript, project?.transcriptProvenance]);
  const revisionCursor = currentRevisionIndex(project);
  const playhead = Math.min(rawPlayhead, project?.duration ?? rawPlayhead);
  const selectedClip = useMemo(
    () => project?.clips.find(clip => clip.id === selectedClipId),
    [project?.clips, selectedClipId]
  );
  const selectedClips = (project?.clips ?? []).filter(
    c =>
      c.id === selectedClipId ||
      (selectedClipId && extraSelection.includes(c.id))
  );
  const selectedIds = selectedClips.map(c => c.id);
  const selectionLocked = selectedClips.some(c => c.locked);
  useEffect(
    () => setClipDraft(selectedClip ? { ...selectedClip } : null),
    [selectedClip]
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
    transcriptBase.current = {
      projectId: item.id,
      value: JSON.stringify(item.transcript),
    };
    setTranscriptConflict(false);
    setSelectedProjectId(item.id);
    setDurationDraft(null);
    setTitleDraft(item.title);
    setPlayhead(item.playhead);
    setTranscriptDraft(item.transcript.map(segment => ({ ...segment })));
    setTranscriptionProvenance(item.transcriptProvenance ?? null);
    setSelectedClipId(firstClip?.id ?? null);
    setExtraSelection([]);
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
      revisionIndex: 0,
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
              : transformed.clips.length !== item.clips.length ||
                  transformed.clips.some(
                    (clip, index) =>
                      clip.id !== item.clips[index]?.id ||
                      clip.start !== item.clips[index]?.start ||
                      clip.duration !== item.clips[index]?.duration
                  )
                ? transformed.clips.length > item.clips.length &&
                  item.clips.length > 0
                  ? Math.max(
                      item.duration,
                      getProjectDuration(transformed.clips)
                    )
                  : getProjectDuration(transformed.clips)
                : item.duration,
          updatedAt: new Date().toISOString(),
        };
        const unchanged =
          JSON.stringify({
            clips: item.clips,
            transcript: item.transcript,
            duration: item.duration,
            captionStyle: item.captionStyle,
            captionAppearance: item.captionAppearance,
            aspectRatio: item.aspectRatio,
            storyBeats: item.storyBeats,
          }) ===
          JSON.stringify({
            clips: next.clips,
            transcript: next.transcript,
            duration: next.duration,
            captionStyle: next.captionStyle,
            captionAppearance: next.captionAppearance,
            aspectRatio: next.aspectRatio,
            storyBeats: next.storyBeats,
          });
        if (unchanged) return item;
        return {
          ...next,
          ...appendEditorRevisions(
            item,
            [snapshotProject(next, label)],
            snapshotProject(item, "Project opened")
          ),
        };
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
    insertAt?: number,
    destination?: TimelineLane
  ) => {
    asset = { ...asset, duration: await resolveMediaDuration(asset) };
    await updateWorkspace(current => {
      const target = current.projects.find(item => item.id === targetProjectId);
      if (!target) return current;
      const timelineEnd = target.clips.reduce(
        (latest, clip) => Math.max(latest, clip.start + clip.duration),
        0
      );
      const start = Math.max(0, insertAt ?? timelineEnd);
      const duration =
        asset.duration && asset.duration > 0
          ? asset.duration
          : asset.kind === "image"
            ? 3
            : 0;
      const track: TrackKind = asset.kind === "audio" ? "audio" : "video";
      const clip: TimelineClip = {
        id: createId("clip"),
        assetId: asset.id,
        track,
        lane: allocateTimelineLane(
          target.clips,
          track === "audio" ? "audio" : "video",
          start,
          duration,
          destination?.kind === track ? destination.number : 1
        ),
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
        duration: target.clips.length
          ? Math.max(target.duration, getProjectDuration(clips))
          : getProjectDuration(clips),
        updatedAt: new Date().toISOString(),
      };
      const history = appendEditorRevisions(
        target,
        [snapshotProject(updatedProject, `Added ${asset.name}`)],
        snapshotProject(target, "Project opened")
      );
      setSelectedClipId(clip.id);
      setExtraSelection([]);
      setClipDraft({ ...clip });

      return {
        ...current,
        assets: current.assets.some(item => item.id === asset.id)
          ? current.assets.map(item => (item.id === asset.id ? asset : item))
          : [asset, ...current.assets],
        projects: current.projects.map(item =>
          item.id === targetProjectId ? { ...updatedProject, ...history } : item
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

  const dropLibraryAsset = async (
    asset: Asset,
    time: number,
    lane: TimelineLane
  ) => {
    if (!project || busyAction) return;
    const requiredLane = asset.kind === "audio" ? "audio" : "video";
    if (lane.kind !== requiredLane) {
      setLocalError(
        `Drop ${asset.kind === "audio" ? "audio" : "video or images"} on a ${requiredLane === "audio" ? "Audio" : "Video"} lane.`
      );
      return;
    }
    setBusyAction(`library-${asset.id}`);
    try {
      await addAssetToTimeline(
        asset,
        project.id,
        "Library media added",
        time,
        lane
      );
      seekTimeline(time);
    } catch (cause) {
      setLocalError(
        cause instanceof Error ? cause.message : "The file could not be added."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const moveTimelineClip = async (
    clip: TimelineClip,
    time: number,
    destination: TimelineLane
  ) => {
    if (clip.locked) return;
    const kind = clipLaneKind(clip);
    if (destination.kind !== kind) {
      setLocalError(
        `Move this clip to a ${kind === "video" ? "Video" : kind} lane.`
      );
      return;
    }
    await saveProjectChange(
      () =>
        commitProject("Clip moved", current => {
          if (selectedIds.includes(clip.id) && selectedIds.length > 1)
            return moveClipGroup(
              current,
              selectedIds,
              clip.id,
              time,
              destination.number
            );
          const lane = allocateTimelineLane(
            current.clips,
            kind,
            time,
            clip.duration,
            destination.number,
            clip.id
          );
          const next = applyEditOperation(current, {
            id: createId("move"),
            type: "move",
            targetClipIds: [clip.id],
            start: time,
            end: time + clip.duration,
            parameters: { destination: time },
            label: "Move clip",
            reason: "Manual timeline edit",
            confidence: 1,
            intensity: "balanced",
            status: "accepted",
          });
          next.clips = next.clips.map(c =>
            c.id === clip.id ? { ...c, lane } : c
          );
          return next;
        }),
      "The clip could not be moved."
    );
    setSelectedClipId(clip.id);
    setExtraSelection(
      selectedIds.includes(clip.id)
        ? selectedIds.filter(id => id !== clip.id)
        : []
    );
    seekTimeline(time);
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
    targetProjectId?: string | null,
    insertAt?: number,
    destination?: TimelineLane
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

        await addAssetToTimeline(
          asset,
          projectId,
          "Media uploaded and added",
          insertAt,
          destination
        );
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
    await saveProjectChange(
      () =>
        commitProject("Clip adjusted", current =>
          replaceTimelineClip(
            current,
            clipDraft.id,
            normalizeClipTiming(
              {
                ...clipDraft,
                ...(selectedClip.graphic
                  ? {
                      graphicDuration:
                        selectedClip.graphicDuration ?? selectedClip.outPoint,
                    }
                  : {}),
              },
              previewAsset,
              current.duration
            )
          )
        ),
      "Clip timing could not be saved."
    );
  };

  const splitSelectedClip = async () => {
    if (!selectedClip || selectedClip.locked) return;
    const relativeSplit = playhead - selectedClip.start;
    const minimumSplitSpan = Math.min(0.001, selectedClip.duration / 3);
    if (
      relativeSplit < minimumSplitSpan ||
      relativeSplit > selectedClip.duration - minimumSplitSpan
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
          transcript: current.transcript.map(segment =>
            segment.sourceClipId === selectedClip.id &&
            segment.start >= playhead
              ? { ...segment, sourceClipId: rightId }
              : segment
          ),
          clips: current.clips.flatMap(clip => {
            if (clip.id !== selectedClip.id) return [clip];
            clip = preserveGraphicDuration(clip);
            const left = {
              ...clip,
              duration: relativeSplit,
              fadeOut: 0,
              outPoint: clip.inPoint + relativeSplit * (clip.speed ?? 1),
            };
            const right = {
              ...clip,
              id: rightId,
              label: `${clip.label} · B`,
              fadeIn: 0,
              start: playhead,
              duration: clip.duration - relativeSplit,
              inPoint: clip.inPoint + relativeSplit * (clip.speed ?? 1),
            };
            return [left, right];
          }),
        })),
      "The clip could not be split."
    );
    if (!saved) return;
    setSelectedClipId(rightId);
    setExtraSelection([]);
    setClipDraft({
      ...selectedClip,
      id: rightId,
      label: `${selectedClip.label} · B`,
      fadeIn: 0,
      start: playhead,
      duration: selectedClip.duration - relativeSplit,
      inPoint: selectedClip.inPoint + relativeSplit * (selectedClip.speed ?? 1),
    });
    setLocalError(null);
  };

  const duplicateSelectedClip = async () => {
    if (!selectedClips.length) return;
    let ids: string[] = [];
    const saved = await saveProjectChange(
      () =>
        commitProject("Clips duplicated", current => {
          const result = pasteClipGroup(
            current,
            selectedClips,
            Math.max(...selectedClips.map(c => c.start + c.duration)),
            () => createId("clip")
          );
          ids = result.ids;
          return result.project;
        }),
      "The selection could not be duplicated."
    );
    if (saved) {
      setSelectedClipId(ids[0]);
      setExtraSelection(ids.slice(1));
    }
  };

  const deleteSelectedClip = async () => {
    if (!selectedClips.length || selectionLocked) return;
    const saved = await saveProjectChange(
      () =>
        commitProject("Selection deleted", current => ({
          ...deleteClipGroup(current, selectedIds),
          activeAssetId:
            current.activeAssetId === selectedClip?.assetId
              ? current.clips.find(
                  clip => !selectedIds.includes(clip.id) && clip.assetId
                )?.assetId
              : current.activeAssetId,
        })),
      "The clip could not be deleted."
    );
    if (!saved) return;
    setSelectedClipId(null);
    setExtraSelection([]);
    setClipDraft(null);
  };

  const toggleClipProperty = async (property: "locked" | "muted") => {
    if (!selectedClip || (property === "muted" && selectedClip.locked)) return;
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
      () => patchProject(current => restoreEditorRevision(current, nextCursor)),
      "Undo could not be saved."
    );
    if (!saved) return;
    setTranscriptDraft(revision.transcript.map(segment => ({ ...segment })));
    setTranscriptionProvenance(revision.transcriptProvenance ?? null);
    const restoredClip =
      revision.clips.find(clip => clip.id === selectedClipId) ??
      revision.clips[0];
    setSelectedClipId(restoredClip?.id ?? null);
    setExtraSelection([]);
    setClipDraft(restoredClip ? { ...restoredClip } : null);
  };

  const redo = async () => {
    if (!project || revisionCursor >= project.revisions.length - 1) return;
    const nextCursor = revisionCursor + 1;
    const revision = project.revisions[nextCursor];
    if (!revision) return;
    const saved = await saveProjectChange(
      () => patchProject(current => restoreEditorRevision(current, nextCursor)),
      "Redo could not be saved."
    );
    if (!saved) return;
    setTranscriptDraft(revision.transcript.map(segment => ({ ...segment })));
    setTranscriptionProvenance(revision.transcriptProvenance ?? null);
    const restoredClip =
      revision.clips.find(clip => clip.id === selectedClipId) ??
      revision.clips[0];
    setSelectedClipId(restoredClip?.id ?? null);
    setExtraSelection([]);
    setClipDraft(restoredClip ? { ...restoredClip } : null);
  };

  const pasteClip = async () => {
    const copied = clipboardRef.current;
    if (!copied.length || !project) return;
    let ids: string[] = [];
    const saved = await saveProjectChange(
      () =>
        commitProject("Clips pasted", current => {
          const result = pasteClipGroup(
            current,
            copied,
            playhead,
            () => createId("clip"),
            clipboardTranscript.current
          );
          ids = result.ids;
          return result.project;
        }),
      "The selection could not be pasted."
    );
    if (saved) {
      setSelectedClipId(ids[0]);
      setExtraSelection(ids.slice(1));
    }
  };

  const openLibrary = () => {
    setLeftTool("library");
    requestAnimationFrame(() =>
      document
        .getElementById("editor-media-panel")
        ?.scrollIntoView({ block: "center", behavior: "smooth" })
    );
  };
  const detachSelectedAudio = async () => {
    if (!selectedClip) return;
    await saveProjectChange(
      () =>
        commitProject("Detached source audio", p =>
          detachClipAudio(
            p,
            selectedClip.id,
            workspace.assets,
            createId("audio")
          )
        ),
      "Could not detach audio."
    );
  };
  const trimAtPlayhead = async (side: "start" | "end") => {
    if (
      !selectedClip ||
      selectedClip.locked ||
      playhead <= selectedClip.start ||
      playhead >= selectedClip.start + selectedClip.duration
    )
      return;
    const edited = trimTimelineClip(selectedClip, side, playhead);
    await saveProjectChange(
      () =>
        commitProject("Trimmed to playhead", p =>
          replaceTimelineClip(p, selectedClip.id, edited)
        ),
      "Could not trim clip."
    );
  };
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !project ||
        exportOpen ||
        target?.closest(
          "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='dialog'], [role='listbox'], [role='menu']"
        )
      )
        return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (
        modifier &&
        (key === "c" || key === "x") &&
        window.getSelection()?.toString()
      )
        return;
      let action: (() => void | Promise<unknown>) | undefined;
      if (modifier && key === "z") action = event.shiftKey ? redo : undo;
      else if (modifier && key === "y") action = redo;
      else if (modifier && key === "a")
        action = () => {
          setSelectedClipId(project.clips[0]?.id ?? null);
          setExtraSelection(project.clips.slice(1).map(c => c.id));
        };
      else if (modifier && key === "c" && selectedClip)
        action = () => {
          clipboardRef.current = structuredClone(selectedClips);
          clipboardTranscript.current = structuredClone(project.transcript);
        };
      else if (modifier && key === "x" && selectedClip && !selectionLocked)
        action = async () => {
          clipboardRef.current = structuredClone(selectedClips);
          clipboardTranscript.current = structuredClone(project.transcript);
          await deleteSelectedClip();
        };
      else if (modifier && key === "v" && clipboardRef.current.length)
        action = pasteClip;
      else if (modifier && key === "d" && selectedClip)
        action = duplicateSelectedClip;
      else if (
        !modifier &&
        !event.altKey &&
        (key === "delete" || key === "backspace") &&
        selectedClip
      )
        action = deleteSelectedClip;
      else if (!modifier && !event.altKey && key === "s" && selectedClip)
        action = splitSelectedClip;
      else if (!modifier && !event.altKey && event.shiftKey && key === "d")
        action = detachSelectedAudio;
      else if (!modifier && !event.altKey && event.shiftKey && key === "l")
        action = () => toggleClipProperty("locked");
      else if (!modifier && !event.altKey && key === "m")
        action = () => toggleClipProperty("muted");
      else if (!modifier && !event.altKey && key === "q")
        action = () => trimAtPlayhead("start");
      else if (!modifier && !event.altKey && key === "w")
        action = () => trimAtPlayhead("end");
      else if (!modifier && !event.altKey && key === "n")
        action = () => setSnapping(v => !v);
      else if (!modifier && !event.altKey && key === "home")
        action = () => seekTimeline(0);
      else if (!modifier && !event.altKey && key === "end")
        action = () => seekTimeline(project.duration);
      else if (!modifier && !event.altKey && ["j", "l"].includes(key))
        action = () => seekTimeline(playhead + (key === "j" ? -1 : 1));
      else if (!modifier && !event.altKey && ["+", "=", "-", "0"].includes(key))
        action = () =>
          setTimelineZoom(z =>
            key === "0"
              ? 100
              : Math.max(
                  25,
                  Math.min(1600, z * (key === "-" ? 1 / 1.25 : 1.25))
                )
          );
      else if (!modifier && !event.altKey && key === "escape")
        action = () => {
          setSelectedClipId(null);
          setExtraSelection([]);
          setClipDraft(null);
        };
      else if (!modifier && !event.altKey && event.shiftKey && key === "b")
        action = openLibrary;
      else if (!modifier && !event.altKey && event.shiftKey && key === "i")
        action = () => setInspectorOpen(true);
      else if (modifier && !event.altKey && key === "/")
        action = () => setShortcutsOpen(true);
      else if (
        !modifier &&
        !event.altKey &&
        (event.code === "Space" || key === "k")
      )
        action = toggleTimelinePlayback;
      else if (
        !modifier &&
        !event.altKey &&
        (key === "arrowleft" || key === "arrowright")
      )
        action = () =>
          seekTimeline(
            playhead +
              (key === "arrowright" ? 1 : -1) * (event.shiftKey ? 1 : 1 / 30)
          );
      if (!action) return;
      event.preventDefault();
      if (
        (event.repeat &&
          !["arrowleft", "arrowright", "j", "l", "+", "=", "-"].includes(
            key
          )) ||
        busyAction ||
        keyboardActionPending.current
      )
        return;
      keyboardActionPending.current = true;
      void Promise.resolve()
        .then(action)
        .finally(() => {
          keyboardActionPending.current = false;
        });
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  });

  const saveTranscript = async () => {
    if (
      project &&
      transcriptDraft.some(
        s =>
          !Number.isFinite(s.start) ||
          !Number.isFinite(s.end) ||
          s.start < 0 ||
          s.end <= s.start ||
          s.end > project.duration
      )
    ) {
      setLocalError("Correct the caption time ranges before saving.");
      return;
    }

    if (
      project &&
      transcriptBase.current?.projectId === project.id &&
      transcriptBase.current.value !== JSON.stringify(project.transcript)
    ) {
      setTranscriptConflict(true);
      setLocalError(
        "Captions changed while you were editing. Load the saved captions before applying another revision."
      );
      return;
    }
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
            sourceClipId: clip.id,
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

  const canvasContent = (
    <div className="grid gap-4">
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
    </div>
  );
  const looksContent = (
    <div className="space-y-4">
      <p className="text-sm text-foreground/65">
        {selectedClip
          ? `Apply to ${selectedClip.label}`
          : "Select a video or image on the timeline."}
      </p>{" "}
      <EditorPresetLibrary
        mode="looks"
        disabled={!selectedClip || selectedClip?.locked || Boolean(busyAction)}
        onClipLook={preset =>
          void saveProjectChange(
            () =>
              commitProject(`Applied ${preset.name}`, current => ({
                ...current,
                clips: current.clips.map(c =>
                  c.id === selectedClip?.id && !c.locked
                    ? { ...c, ...preset.settings }
                    : c
                ),
              })),
            "The look could not be applied."
          )
        }
        onFadePreset={settings =>
          void saveProjectChange(
            () =>
              commitProject("Applied clip transition", current => ({
                ...current,
                clips: current.clips.map(c =>
                  c.id === selectedClip?.id && !c.locked
                    ? { ...c, ...settings }
                    : c
                ),
              })),
            "The transition could not be applied."
          )
        }
      />
      <EditorInfo label="Transitions between shots">
        Use entrance and exit fades for a single shot. For an overlapping
        dissolve, place the incoming clip on a higher video lane and fade it in
        over the outgoing clip.
      </EditorInfo>
    </div>
  );
  const inspectorContent = (
    <ClipInspector
      draft={clipDraft}
      setDraft={setClipDraft}
      asset={previewAsset}
      duration={project.duration}
      canvas={canvasContent}
      onApply={applyClipDraft}
      onToggle={toggleClipProperty}
      onDetach={detachSelectedAudio}
      onGraphic={async graphic => {
        await commitProject("Updated motion graphic", p => ({
          ...p,
          clips: p.clips.map(c =>
            c.id === selectedClip?.id && !c.locked
              ? { ...c, graphic, label: graphic.text.trim() || c.label }
              : c
          ),
        }));
      }}
    />
  );
  const captionsContent = (
    <>
      {
        <div>
          <details className="mb-4 rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Caption style library
            </summary>
            <div className="mt-3">
              <EditorPresetLibrary
                mode="captions"
                selectedCaptionId={project.captionStyle}
                onCaptionPreset={id =>
                  void saveProjectChange(
                    () =>
                      commitProject("Caption style changed", current => ({
                        ...current,
                        captionStyle: id,
                        captionAppearance: undefined,
                      })),
                    "Caption style could not be saved."
                  )
                }
              />
            </div>
          </details>
          <div className="mb-4">
            <CaptionAppearanceEditor
              key={`${project.captionStyle}:${JSON.stringify(project.captionAppearance)}`}
              presetId={project.captionStyle}
              appearance={project.captionAppearance}
              sample={
                transcriptDraft.find(
                  s => s.start <= playhead && s.end > playhead
                )?.text ??
                transcriptDraft[0]?.text ??
                ""
              }
              onApply={async captionAppearance => {
                await saveProjectChange(
                  () =>
                    commitProject("Caption appearance changed", p => ({
                      ...p,
                      captionAppearance,
                    })),
                  "Could not save caption style."
                );
              }}
            />
          </div>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="mono-eyebrow text-primary">Editable transcript</p>
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

          {transcriptConflict && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
            >
              Captions changed while you had an unsaved draft. Your draft is
              kept here for comparison.
              <button
                type="button"
                className="mt-2 block font-medium underline"
                onClick={() => {
                  setTranscriptDraft(
                    project.transcript.map(segment => ({ ...segment }))
                  );
                  setTranscriptionProvenance(
                    project.transcriptProvenance ?? null
                  );
                  transcriptBase.current = {
                    projectId: project.id,
                    value: JSON.stringify(project.transcript),
                  };
                  setTranscriptConflict(false);
                }}
              >
                Load saved captions
              </button>
            </div>
          )}
          <div className="mb-4">
            <CaptionFileTools
              segments={transcriptDraft}
              duration={project.duration}
              onImport={segments => {
                setTranscriptDraft(segments);
                setTranscriptionProvenance(null);
                void saveProjectChange(
                  () =>
                    commitProject("Captions imported", current => ({
                      ...current,
                      transcript: segments,
                      transcriptProvenance: undefined,
                    })),
                  "Imported captions could not be saved."
                );
              }}
            />
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
              <AiProvenanceBadge provenance={transcriptionProvenance} compact />
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
                  onSelect={event => {
                    captionCursors.current[segment.id] =
                      event.currentTarget.selectionStart;
                  }}
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
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => seekTimeline(segment.start)}
                    className="rounded-md border border-border px-2 py-1.5"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parts = splitCaption(
                          segment,
                          captionCursors.current[segment.id] ?? 0,
                          playhead,
                          createId("caption")
                        );
                        mutateTranscript(rows =>
                          rows.flatMap(row =>
                            row.id === segment.id ? parts : [row]
                          )
                        );
                      } catch (e) {
                        setLocalError(
                          e instanceof Error
                            ? e.message
                            : "Could not split caption."
                        );
                      }
                    }}
                    className="rounded-md border border-border px-2 py-1.5"
                  >
                    Split at playhead
                  </button>
                  <EditorInfo label="Split a caption">
                    Place the playhead at the spoken break, then put the text
                    cursor before the next phrase. Split keeps those words and
                    uses your chosen time; it does not guess word timing.
                  </EditorInfo>
                  {index < transcriptDraft.length - 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        mutateTranscript(rows =>
                          rows.flatMap((row, i) =>
                            i === index
                              ? [mergeCaptions(row, rows[i + 1])]
                              : i === index + 1
                                ? []
                                : [row]
                          )
                        )
                      }
                      className="rounded-md border border-border px-2 py-1.5"
                    >
                      Merge next
                    </button>
                  )}
                </div>
                {captionIssues(segment, transcriptDraft, project.duration).map(
                  issue => (
                    <p
                      key={issue}
                      className="mt-2 text-xs text-amber-600 dark:text-amber-300"
                    >
                      {issue}
                    </p>
                  )
                )}
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
      }
    </>
  );

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
          disabled={saving || Boolean(busyAction)}
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
        <button
          type="button"
          onClick={() => setAutoEditOpen(true)}
          className="ai-magic flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          <Sparkles className="size-4" /> AI auto-edit
        </button>
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

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(240px,0.85fr)_minmax(300px,1.35fr)_minmax(310px,1fr)] xl:items-start">
        <section
          id="editor-media-panel"
          className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface xl:col-start-1 xl:row-start-1 xl:h-[620px] xl:overflow-y-auto"
        >
          {" "}
          <EditorCreationDock
            onAssist={context => setChatSeed({ text: context, id: Date.now() })}
            activeTool={leftTool}
            onToolChange={setLeftTool}
            captions={captionsContent}
            effects={looksContent}
            project={project}
            playhead={playhead}
            onInsert={addLibraryAssetAtPlayhead}
            onGraphic={async (graphic, seconds) => {
              await commitProject("Added motion graphic", p =>
                applyEditOperation(p, {
                  id: createId("graphic-operation"),
                  type: "graphic",
                  label: graphic.text || graphic.kind,
                  reason: "Manually added graphic",
                  start: playhead,
                  end: Math.min(p.duration, playhead + seconds),
                  confidence: 1,
                  intensity: "balanced",
                  targetClipIds: [],
                  status: "proposed",
                  parameters: { graphic },
                })
              );
            }}
          />
        </section>
        <main className="contents">
          <section
            {...previewDrop.dropZoneProps}
            className={`relative min-w-0 overflow-hidden rounded-xl border xl:col-start-2 xl:row-start-1 xl:h-[620px] bg-[#0D0C0E] shadow-card transition-all ${
              previewDrop.isDragging
                ? "border-[#A894FF] ring-4 ring-[#A894FF]/20"
                : "border-white/5"
            }`}
          >
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/60 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A894FF]" />
              {italian ? "Anteprima timeline" : "Timeline preview"}
            </div>
            <div
              className={`relative flex h-[490px] touch-none items-center justify-center overflow-hidden p-7 ${previewZoom > 100 ? "cursor-grab active:cursor-grabbing" : ""}`}
              onPointerDown={e => {
                if (previewZoom <= 100) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                previewDrag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  ox: previewPan.x,
                  oy: previewPan.y,
                };
              }}
              onPointerMove={e => {
                const d = previewDrag.current;
                if (d)
                  setPreviewPan({
                    x: d.ox + e.clientX - d.x,
                    y: d.oy + e.clientY - d.y,
                  });
              }}
              onPointerUp={() => {
                previewDrag.current = null;
              }}
              onPointerCancel={() => {
                previewDrag.current = null;
              }}
            >
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
                zoom={previewZoom / 100}
                pan={previewPan}
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-surface px-3 py-2 text-sm text-foreground">
              <CompactSelect
                aria-label="Preview aspect ratio"
                value={project.aspectRatio}
                onValueChange={value => {
                  setPreviewPan({ x: 0, y: 0 });
                  void saveProjectChange(
                    () =>
                      commitProject("Aspect ratio changed", p => ({
                        ...p,
                        aspectRatio: value as EditProject["aspectRatio"],
                      })),
                    "Could not change format."
                  );
                }}
                options={[
                  { value: "9:16", label: "9:16 Portrait" },
                  { value: "16:9", label: "16:9 Landscape" },
                  { value: "1:1", label: "1:1 Square" },
                ]}
                className="w-36"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-sm"
                  >
                    <ZoomIn className="size-4" />
                    {previewZoom === 100 ? "Fit" : `${previewZoom}%`}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 rounded-xl">
                  <p className="mb-3 text-sm font-semibold">Preview zoom</p>
                  <input
                    type="range"
                    min={25}
                    max={400}
                    step={5}
                    value={previewZoom}
                    aria-label="Preview zoom"
                    onChange={e => {
                      setPreviewZoom(Number(e.target.value));
                      setPreviewPan({ x: 0, y: 0 });
                    }}
                    className="w-full accent-primary"
                  />
                  <div className="mt-3 flex gap-2">
                    {[50, 100, 200, 400].map(value => (
                      <button
                        type="button"
                        key={value}
                        className="rounded-md border border-border px-2 py-1 text-xs"
                        onClick={() => {
                          setPreviewZoom(value);
                          setPreviewPan({ x: 0, y: 0 });
                        }}
                      >
                        {value === 100 ? "Fit" : `${value}%`}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-foreground/65">
                    Zoom is for inspecting your edit. Drag the enlarged preview
                    to pan. Export framing stays unchanged.
                  </p>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => setInspectorOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm"
              >
                <SlidersHorizontal className="size-4" /> Adjust
              </button>
            </div>
          </section>

          <section
            {...timelineDrop.dropZoneProps}
            className={`min-w-0 overflow-hidden rounded-xl border bg-surface shadow-card xl:col-span-3 xl:row-start-2 transition-all ${
              timelineDrop.isDragging
                ? "border-primary ring-4 ring-primary/10"
                : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
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
              <span className="mx-3 text-xs text-foreground/45">or</span>
              <button
                type="button"
                onClick={openLibrary}
                disabled={Boolean(busyAction)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Library className="h-3.5 w-3.5" />
                Add from library
              </button>
              <span className="mx-1 h-5 w-px bg-border" />
              <button
                type="button"
                disabled={!selectedClip}
                onClick={() => setInspectorOpen(true)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-background disabled:opacity-30"
              >
                <SlidersHorizontal size={15} />
                Adjust clip
              </button>
              <button
                type="button"
                disabled={!selectedClip || selectedClip.locked}
                title="Split at playhead (S)"
                onClick={() => void splitSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-30"
              >
                <Scissors className="h-3.5 w-3.5" />
                Split
              </button>
              <button
                type="button"
                disabled={!selectedClip}
                title="Duplicate (Ctrl/⌘ D)"
                onClick={() => void duplicateSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-30"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </button>
              <button
                type="button"
                disabled={!selectedClips.length || selectionLocked}
                title="Delete selection (Delete)"
                onClick={() => void deleteSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
                {selectedClips.length > 1 ? ` (${selectedClips.length})` : ""}
              </button>
              <EditorInfo label="Selecting multiple clips">
                Hold <kbd>Shift</kbd> and click to add or remove clips from the
                selection. Drag a selected clip to move the group together.
                Copy, duplicate and delete work on the selection. Locked clips
                must be unlocked before moving or deleting the group.
              </EditorInfo>
              <div className="ml-auto flex items-center gap-2 pr-1">
                {uploadProgress !== null && (
                  <span className="font-mono text-xs text-primary">
                    {uploadProgress}%
                  </span>
                )}
                <span className="text-xs text-foreground/70">Zoom</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={(Math.log(timelineZoom / 25) / Math.log(64)) * 100}
                  onChange={event =>
                    setTimelineZoom(
                      25 * Math.pow(64, Number(event.target.value) / 100)
                    )
                  }
                  className="h-1 w-36 sm:w-44 accent-primary"
                  aria-label="Timeline zoom"
                  aria-valuetext={`${Math.round(timelineZoom)}%`}
                />
                <button
                  type="button"
                  onClick={() => setTimelineZoom(100)}
                  className="rounded-md px-2 py-1 text-xs text-foreground/65 hover:bg-background"
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => setShortcutsOpen(true)}
                  title="Keyboard shortcuts (Ctrl/⌘ + /)"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs"
                >
                  <Keyboard className="size-4" />
                  <span className="hidden sm:inline">Shortcuts</span>
                </button>
              </div>
            </div>

            <StoryBeatStrip
              beats={project.storyBeats ?? []}
              duration={project.duration}
              time={playhead}
              hasEvidence={buildStoryBeatEvidence(project).length > 0}
              stale={
                Boolean(project.storyBeats?.length) &&
                !storyBeatsAreCurrent(
                  project.storyBeats ?? [],
                  buildStoryBeatEvidence(project)
                )
              }
              onSeek={seekTimeline}
              onChange={async storyBeats => {
                await commitProject("Story sections updated", p => ({
                  ...p,
                  storyBeats,
                }));
              }}
              onGenerate={() => {
                setChatSeed({
                  text: "Find the hook, body, proof and payoff in this footage and divide it into clearly named story sections. Use the actual speech and visual evidence.",
                  id: Date.now(),
                });
                document
                  .getElementById("editor-chat-panel")
                  ?.scrollIntoView({ block: "nearest" });
              }}
            />
            <TimelinePrompt
              key={project.id}
              duration={project.duration}
              busy={Boolean(busyAction)}
              credits={AI_CREDIT_COSTS.editPlan}
              onSend={async (text, range) => {
                setChatSeed({ text, range, id: Date.now() });
                document
                  .getElementById("editor-chat-panel")
                  ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }}
            />
            <TimelineTracks
              project={project}
              assets={workspace.assets}
              time={playhead}
              zoom={timelineZoom}
              snapping={snapping}
              onSnappingChange={setSnapping}
              selectedClipId={selectedClipId}
              selectedClipIds={selectedIds}
              disabled={Boolean(busyAction)}
              onSeek={seekTimeline}
              onSelect={(clip, time, additive) => {
                if (additive && selectedIds.includes(clip.id)) {
                  const remaining = selectedIds.filter(id => id !== clip.id);
                  setSelectedClipId(remaining[0] ?? null);
                  setExtraSelection(remaining.slice(1));
                } else {
                  setSelectedClipId(clip.id);
                  setExtraSelection(
                    additive ? selectedIds.filter(id => id !== clip.id) : []
                  );
                  setClipDraft({ ...clip });
                }
                seekTimeline(time);
              }}
              onAssetDrop={(asset, time, lane) =>
                dropLibraryAsset(asset, time, lane)
              }
              onFilesDrop={async (files, time, lane) => {
                const selection = validateFileSelection(files, {
                  multiple: true,
                  purpose: "media",
                });
                if (selection.error) {
                  setLocalError(selection.error);
                  return;
                }
                await addUploadedFiles(selection.files, project.id, time, lane);
              }}
              onMove={moveTimelineClip}
              onTrim={async clip => {
                await saveProjectChange(
                  () =>
                    commitProject("Clip trimmed", current =>
                      replaceTimelineClip(current, clip.id, clip)
                    ),
                  "The clip could not be trimmed."
                );
                setClipDraft(clip);
              }}
              onCaptionSelect={time => {
                setLeftTool("captions");
                seekTimeline(time);
              }}
            />
          </section>
        </main>

        <aside
          id="editor-chat-panel"
          className="min-w-0 overflow-hidden rounded-xl border border-primary/20 bg-surface xl:col-start-3 xl:row-start-1 xl:h-[620px]"
        >
          <EditorChat
            key={project.id}
            project={project}
            playhead={playhead}
            selectedClipId={selectedClipId}
            seed={chatSeed}
            onSeek={seekTimeline}
            onAutoEdit={() => setAutoEditOpen(true)}
          />
        </aside>
      </div>

      <EditorShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>Adjust</DialogTitle>
          <DialogDescription>
            Clip settings, canvas and the end of your edit.
          </DialogDescription>
          {inspectorContent}
        </DialogContent>
      </Dialog>

      <Dialog open={autoEditOpen} onOpenChange={setAutoEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogTitle>AI auto-edit</DialogTitle>
          <DialogDescription>
            Build a complete edit from your footage and a reference style.
          </DialogDescription>
          <AutonomousEditor
            key={project.id}
            project={project}
            onFinished={() => {
              setAutoEditOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
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
