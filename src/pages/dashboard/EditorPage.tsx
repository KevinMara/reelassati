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
  Clock3,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Lock,
  Maximize2,
  Mic2,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
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
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function formatVttTime(seconds: number) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainder = (milliseconds % 60_000) / 1000;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${remainder.toFixed(3).padStart(6, "0")}`;
}

function transcriptTrack(segments: TranscriptSegment[]): string | null {
  const cues = segments
    .filter(segment => segment.text.trim())
    .map(
      (segment, index) =>
        `${index + 1}\n${formatVttTime(segment.start)} --> ${formatVttTime(
          Math.max(segment.end, segment.start + 0.1)
        )}\n${segment.text.replaceAll("-->", "→").trim()}`
    );
  if (cues.length === 0) return null;
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(
    `WEBVTT\n\n${cues.join("\n\n")}\n`
  )}`;
}

function snapshotProject(project: EditProject, label: string): EditRevision {
  return {
    id: createId("revision"),
    label,
    createdAt: new Date().toISOString(),
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

function getProjectDuration(clips: TimelineClip[], minimum = 15) {
  return Math.max(minimum, ...clips.map(clip => clip.start + clip.duration));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getAssetKind(file: File): Asset["kind"] {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return "video";
}

function readMediaDuration(file: File): Promise<number | undefined> {
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
    return Promise.resolve(undefined);
  }

  return new Promise(resolve => {
    const media = document.createElement(
      file.type.startsWith("audio/") ? "audio" : "video"
    );
    const objectUrl = URL.createObjectURL(file);
    const finish = (duration?: number) => {
      URL.revokeObjectURL(objectUrl);
      media.remove();
      resolve(duration);
    };
    media.preload = "metadata";
    media.onloadedmetadata = () =>
      finish(Number.isFinite(media.duration) ? media.duration : undefined);
    media.onerror = () => finish(undefined);
    media.src = objectUrl;
  });
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
      clip.duration > clip.outPoint - clip.inPoint + 0.01 ||
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

function projectWithApprovedOperation(
  project: EditProject,
  operation: EditOperation
) {
  return {
    ...project,
    proposedChanges: project.proposedChanges.map(change =>
      change.id === operation.id
        ? {
            ...change,
            status: "accepted" as const,
            reviewedAt: new Date().toISOString(),
          }
        : change
    ),
  };
}

export default function EditorPage() {
  const {
    workspace,
    capabilities,
    loading,
    saving,
    error: workspaceError,
    updateWorkspace,
  } = useWorkspace();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
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
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [revisionCursor, setRevisionCursor] = useState(-1);
  const [timelineZoom, setTimelineZoom] = useState(100);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaPreviewRef = useRef<HTMLMediaElement | null>(null);

  const project = useMemo(
    () => workspace.projects.find(item => item.id === selectedProjectId),
    [selectedProjectId, workspace.projects]
  );
  const selectedClip = useMemo(
    () => project?.clips.find(clip => clip.id === selectedClipId),
    [project?.clips, selectedClipId]
  );
  const previewAsset = useMemo(() => {
    const assetId = selectedClip?.assetId ?? project?.activeAssetId;
    return workspace.assets.find(asset => asset.id === assetId);
  }, [project?.activeAssetId, selectedClip?.assetId, workspace.assets]);
  const mediaTimeForPlayhead = useCallback(
    (timelineTime: number) => {
      if (!selectedClip) return Math.max(0, timelineTime);
      const speed = Math.max(0.1, selectedClip.speed ?? 1);
      const relativeTime = Math.min(
        selectedClip.duration,
        Math.max(0, timelineTime - selectedClip.start)
      );
      return Math.min(
        selectedClip.outPoint,
        selectedClip.inPoint + relativeTime * speed
      );
    },
    [selectedClip]
  );
  const playheadForMediaTime = useCallback(
    (mediaTime: number) => {
      if (!project) return 0;
      if (!selectedClip) return clamp(mediaTime, 0, project.duration);
      const speed = Math.max(0.1, selectedClip.speed ?? 1);
      return clamp(
        selectedClip.start + (mediaTime - selectedClip.inPoint) / speed,
        selectedClip.start,
        Math.min(project.duration, selectedClip.start + selectedClip.duration)
      );
    },
    [project, selectedClip]
  );
  const configurePreviewMedia = useCallback(
    (media: HTMLMediaElement) => {
      media.playbackRate = Math.max(0.1, selectedClip?.speed ?? 1);
      media.muted = selectedClip?.muted ?? false;
      media.volume = clamp((selectedClip?.volume ?? 100) / 100, 0, 1);
    },
    [selectedClip]
  );
  const seekTimeline = useCallback(
    (nextTime: number) => {
      const duration = project?.duration ?? 0;
      const boundedTime = clamp(nextTime, 0, duration);
      setPlayhead(boundedTime);
      const media = mediaPreviewRef.current;
      if (media && Number.isFinite(media.duration)) {
        media.currentTime = clamp(
          mediaTimeForPlayhead(boundedTime),
          0,
          media.duration
        );
      }
    },
    [mediaTimeForPlayhead, project?.duration]
  );
  const captionTrackUrl = useMemo(
    () => transcriptTrack(transcriptDraft),
    [transcriptDraft]
  );
  const qualitySignals = useMemo(
    () =>
      project
        ? [...project.qualitySignals, ...deriveQualitySignals(project)].filter(
            (signal, index, all) =>
              all.findIndex(candidate => candidate.id === signal.id) === index
          )
        : [],
    [project]
  );

  const openProject = (item: EditProject) => {
    const firstClip = item.clips[0] ?? null;
    setSelectedProjectId(item.id);
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
    const media = mediaPreviewRef.current;
    if (media) configurePreviewMedia(media);
  }, [configurePreviewMedia, previewAsset?.id]);

  useEffect(() => {
    if (!playing || !project) return;
    if (
      mediaPreviewRef.current &&
      (previewAsset?.kind === "video" || previewAsset?.kind === "audio")
    ) {
      return;
    }
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
    const media = mediaPreviewRef.current;
    if (playing) {
      media?.pause();
      setPlaying(false);
      return;
    }

    const startTime = playhead >= (project?.duration ?? 0) ? 0 : playhead;
    seekTimeline(startTime);
    if (!media) {
      setPlaying(true);
      return;
    }

    configurePreviewMedia(media);
    try {
      await media.play();
      setPlaying(true);
      setLocalError(null);
    } catch (cause) {
      setPlaying(false);
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The media preview could not start."
      );
    }
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
          duration: getProjectDuration(
            transformed.clips,
            Math.max(15, transformed.duration)
          ),
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

        await updateWorkspace(current => {
          const target = current.projects.find(item => item.id === projectId);
          if (!target) return current;
          const start = target.clips.reduce(
            (latest, clip) => Math.max(latest, clip.start + clip.duration),
            0
          );
          const duration =
            asset.duration && asset.duration > 0
              ? asset.duration
              : kind === "image"
                ? 3
                : 5;
          const track: TrackKind =
            kind === "audio" ? "audio" : kind === "image" ? "overlay" : "video";
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
            volume: 100,
            color: TRACK_COLORS[track],
          };
          const clips = [...target.clips, clip];
          const updatedProject = {
            ...target,
            clips,
            activeAssetId: asset.id,
            duration: getProjectDuration(clips, target.duration),
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
              ? current.assets.map(item =>
                  item.id === asset.id ? asset : item
                )
              : [asset, ...current.assets],
            projects: current.projects.map(item =>
              item.id === projectId ? { ...updatedProject, revisions } : item
            ),
            activity: [
              {
                id: createId("event"),
                type: "upload",
                label: "Media uploaded",
                detail: asset.name,
                createdAt: new Date().toISOString(),
              },
              ...current.activity,
            ],
          };
        });
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
          duration: getProjectDuration(revision.clips, 15),
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
          duration: getProjectDuration(revision.clips, 15),
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
          projectWithApprovedOperation(current, operation)
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
      const result = await platformApi.transcribe(
        previewAsset.id,
        workspace.profile.contentLanguage,
        project.id
      );
      setTranscriptDraft(result.segments);
      setTranscriptionProvenance(result.provenance);
      const saved = await commitProject("Media transcribed", current => ({
        ...current,
        transcript: result.segments,
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
            <span className="text-xs text-foreground/50">
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
          <span className="mt-1 text-sm text-foreground/50">
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
          <span className="text-xs text-foreground/45">
            No irreversible auto-edit
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PROJECT_TEMPLATES.map(item => (
            <button
              key={item.template}
              type="button"
              disabled={busyAction === "create"}
              onClick={() => void createProject(item.template)}
              className="group rounded-2xl border border-border bg-surface p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover disabled:opacity-50"
            >
              <span className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" />
              </span>
              <span className="block font-medium">{item.name}</span>
              <span className="mt-2 block text-sm leading-5 text-foreground/50">
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
                  onClick={() => openProject(item)}
                  className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="mono-eyebrow shrink-0 text-foreground/40">
                      {item.aspectRatio}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-foreground/45">
                    <span>{item.clips.length} clips</span>
                    <span>{formatTime(item.duration)}</span>
                    <span className="capitalize">{item.status}</span>
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
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground/55 hover:text-foreground"
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
            className="w-full border-0 bg-transparent p-0 text-xl font-semibold outline-none placeholder:text-foreground/35"
            aria-label="Project title"
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/45">
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
                : "bg-surface text-foreground/50"
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground/55 hover:text-foreground disabled:opacity-30"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={revisionCursor >= project.revisions.length - 1}
            onClick={() => void redo()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground/55 hover:text-foreground disabled:opacity-30"
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
            Prepare export
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

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-4">
          <section
            {...previewDrop.dropZoneProps}
            className={`relative overflow-hidden rounded-2xl border bg-[#0D0C0E] shadow-card transition-all ${
              previewDrop.isDragging
                ? "border-[#A894FF] ring-4 ring-[#A894FF]/20"
                : "border-white/5"
            }`}
          >
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A894FF]" />
              Source preview
            </div>
            <div className="relative flex min-h-[390px] items-center justify-center p-7">
              {previewDrop.isDragging ? (
                <div className="pointer-events-none absolute inset-4 z-20 flex items-center justify-center rounded-xl border border-dashed border-[#A894FF] bg-black/75 text-sm font-medium text-white backdrop-blur-sm">
                  Drop media into this edit
                </div>
              ) : null}
              {previewAsset?.kind === "video" && (
                <video
                  key={previewAsset.id}
                  ref={element => {
                    mediaPreviewRef.current = element;
                  }}
                  src={previewAsset.url}
                  controls
                  onLoadedMetadata={event => {
                    configurePreviewMedia(event.currentTarget);
                    seekTimeline(playhead);
                  }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  onTimeUpdate={event =>
                    setPlayhead(
                      playheadForMediaTime(event.currentTarget.currentTime)
                    )
                  }
                  aria-label={`Video preview: ${previewAsset.name}`}
                  aria-describedby={
                    captionTrackUrl ? undefined : "editor-caption-status"
                  }
                  className={`max-h-[470px] max-w-full bg-black object-contain ${
                    project.aspectRatio === "9:16"
                      ? "aspect-[9/16] rounded-xl"
                      : project.aspectRatio === "1:1"
                        ? "aspect-square rounded-xl"
                        : "aspect-video rounded-xl"
                  }`}
                >
                  {captionTrackUrl ? (
                    <track
                      kind="captions"
                      src={captionTrackUrl}
                      label="Project captions"
                      default
                    />
                  ) : null}
                </video>
              )}
              {previewAsset?.kind === "image" && (
                <img
                  src={previewAsset.url}
                  alt={previewAsset.name}
                  className={`max-h-[470px] max-w-full bg-black object-contain ${
                    project.aspectRatio === "9:16"
                      ? "aspect-[9/16] rounded-xl"
                      : project.aspectRatio === "1:1"
                        ? "aspect-square rounded-xl"
                        : "aspect-video rounded-xl"
                  }`}
                />
              )}
              {previewAsset?.kind === "audio" && (
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white">
                  <AudioLines className="mx-auto mb-5 h-10 w-10 text-[#A894FF]" />
                  <p className="truncate text-sm font-medium">
                    {previewAsset.name}
                  </p>
                  <audio
                    key={previewAsset.id}
                    ref={element => {
                      mediaPreviewRef.current = element;
                    }}
                    src={previewAsset.url}
                    controls
                    onLoadedMetadata={event => {
                      configurePreviewMedia(event.currentTarget);
                      seekTimeline(playhead);
                    }}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onTimeUpdate={event =>
                      setPlayhead(
                        playheadForMediaTime(event.currentTarget.currentTime)
                      )
                    }
                    aria-label={`Audio preview: ${previewAsset.name}`}
                    aria-describedby="editor-audio-alternative"
                    className="mt-5 w-full"
                  />
                  <p id="editor-audio-alternative" className="sr-only">
                    {transcriptDraft.some(segment => segment.text.trim())
                      ? `Transcript: ${transcriptDraft
                          .map(segment => segment.text.trim())
                          .filter(Boolean)
                          .join(" ")}`
                      : "No transcript is available yet. Use the transcription tool to create a text alternative."}
                  </p>
                </div>
              )}
              {!previewAsset && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(busyAction)}
                  className="flex max-w-sm flex-col items-center text-center text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#A894FF]">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="font-medium">
                    Bring your first shot onto the timeline
                  </span>
                  <span className="mt-1 text-sm leading-5 text-white/45">
                    Upload source media. Nothing is cut or transformed without
                    your approval.
                  </span>
                </button>
              )}
              {!captionTrackUrl && previewAsset?.kind === "video" ? (
                <p id="editor-caption-status" className="sr-only">
                  No caption track is available yet. Use the transcript panel to
                  create and review captions.
                </p>
              ) : null}
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
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add media
              </button>
              <span className="hidden text-[11px] text-foreground/40 sm:inline">
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
                  <span className="font-mono text-[10px] text-primary">
                    {uploadProgress}%
                  </span>
                )}
                <span className="text-[10px] text-foreground/40">Zoom</span>
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

            <div className="overflow-x-auto">
              <div
                className="min-w-[680px]"
                style={{ width: `${timelineZoom}%` }}
              >
                <div className="grid grid-cols-[92px_minmax(0,1fr)] border-b border-border bg-background/45">
                  <div className="border-r border-border px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-foreground/35">
                    Time
                  </div>
                  <div className="relative h-7">
                    {Array.from({
                      length: Math.floor(project.duration / 5) + 1,
                    }).map((_, index) => (
                      <span
                        key={index}
                        className="absolute top-1.5 -translate-x-1/2 font-mono text-[9px] text-foreground/35"
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
                        <div className="flex items-center gap-2 border-r border-border bg-background/35 px-3 text-xs text-foreground/50">
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
                              className={`absolute inset-y-1 overflow-hidden rounded-md border px-2 text-left text-[10px] font-medium text-white shadow-sm transition ${
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
                              <span className="mt-0.5 block truncate font-mono text-[8px] text-white/65">
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
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-foreground/40">
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

        <aside className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-card xl:max-h-[calc(100vh-120px)]">
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
                className={`rounded-lg px-2 py-2 text-[11px] font-medium transition ${
                  rightPanel === id
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/45 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[calc(100vh-175px)] overflow-y-auto p-4">
            {rightPanel === "inspect" && (
              <div>
                <div className="mb-5">
                  <p className="mono-eyebrow text-primary">Clip inspector</p>
                  <h2 className="mt-2 text-lg font-medium">
                    {selectedClip ? selectedClip.label : "Select a clip"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-foreground/45">
                    Range controls change the selected clip only. Apply creates
                    a reversible revision.
                  </p>
                </div>

                {!clipDraft ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground/45">
                    Choose a block on the timeline to edit its timing.
                  </div>
                ) : (
                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-1.5 block text-xs text-foreground/50">
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
                          <span className="text-foreground/50">
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
                          className="w-16 rounded border border-border bg-surface px-1.5 py-1 font-mono text-[10px]"
                          aria-label={`Line ${index + 1} start`}
                        />
                        <span className="text-[10px] text-foreground/30">
                          to
                        </span>
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
                          className="w-16 rounded border border-border bg-surface px-1.5 py-1 font-mono text-[10px]"
                          aria-label={`Line ${index + 1} end`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            mutateTranscript(current =>
                              current.filter(item => item.id !== segment.id)
                            )
                          }
                          className="ml-auto text-foreground/35 hover:text-destructive"
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
                        className="w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-foreground/30"
                      />
                    </div>
                  ))}
                </div>

                {transcriptDraft.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm leading-5 text-foreground/45">
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
                <p className="mono-eyebrow text-primary">Accountable AI edit</p>
                <h2 className="mt-2 text-lg font-medium">
                  Describe the change
                </h2>
                <p className="mt-1 text-xs leading-5 text-foreground/45">
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
                    className="w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-foreground/30"
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label>
                      <span className="mb-1 block text-[10px] uppercase tracking-wider text-foreground/40">
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
                      <span className="mb-1 block text-[10px] uppercase tracking-wider text-foreground/40">
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
                  {selectedClip && (
                    <p className="mt-2 truncate text-[10px] text-foreground/40">
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
                    Generate edit plan
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
                            <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[9px] uppercase text-foreground/45">
                              {change.intensity}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-foreground/50">
                            {change.reason}
                          </p>
                          <div className="mt-2 flex items-center gap-3 font-mono text-[9px] text-foreground/40">
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
                            Approve decision
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
                        <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium capitalize text-foreground/45">
                          {change.status === "accepted" ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          {change.status === "accepted"
                            ? "approved for brief"
                            : change.status}
                        </p>
                      )}
                    </div>
                  ))}
                  {project.proposedChanges.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs leading-5 text-foreground/40">
                      No pending AI changes. Your manual timeline remains
                      untouched.
                    </p>
                  )}
                </div>
                <p className="mt-4 text-[10px] leading-4 text-foreground/35">
                  Approval records the decision in the edit brief. AI plans
                  never mutate media automatically; make the deterministic
                  timeline change manually after checking the named interval and
                  target clips.
                </p>
              </div>
            )}

            {rightPanel === "preflight" && (
              <div>
                <p className="mono-eyebrow text-primary">Preflight</p>
                <h2 className="mt-2 text-lg font-medium">
                  Know what needs attention
                </h2>
                <p className="mt-1 text-xs leading-5 text-foreground/45">
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
                        <p className="mt-0.5 text-[10px] text-foreground/45">
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
                    <CircleGauge className="h-4 w-4 text-foreground/35" />
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
                        <p className="mt-1 text-[10px] leading-4 text-foreground/45">
                          {signal.detail}
                        </p>
                        <p className="mt-2 font-mono text-[9px] text-foreground/35">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-modal">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-eyebrow text-primary">Delivery preflight</p>
                <h2 id="export-title" className="mt-2 text-xl font-semibold">
                  Prepare the edit handoff
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-background"
                aria-label="Close export panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-xs text-foreground/45">
                  Platform
                </span>
                <select
                  value={project.platform}
                  onChange={event =>
                    void saveProjectChange(
                      () =>
                        patchProject({
                          platform: event.target
                            .value as EditProject["platform"],
                        }),
                      "The target platform could not be saved."
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-foreground/45">
                  Canvas
                </span>
                <select
                  value={project.aspectRatio}
                  onChange={event =>
                    void saveProjectChange(
                      () =>
                        patchProject({
                          aspectRatio: event.target
                            .value as EditProject["aspectRatio"],
                        }),
                      "The aspect ratio could not be saved."
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="9:16">Vertical 9:16</option>
                  <option value="1:1">Square 1:1</option>
                  <option value="16:9">Landscape 16:9</option>
                </select>
              </label>
            </div>

            <div className="mt-5 space-y-2">
              {preflightChecks.map(check => (
                <div
                  key={check.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-xs">
                    {check.passed ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    {check.label}
                  </span>
                  <span className="text-[10px] text-foreground/40">
                    {check.passed ? "Ready" : "Review"}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/15 bg-destructive/[0.035] px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs">
                  <MoreHorizontal className="h-3.5 w-3.5 text-destructive" />
                  Final video renderer
                </span>
                <span className="text-[10px] text-destructive">
                  Not connected
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-background/55 p-4">
              <p className="text-xs font-medium">What this action creates</p>
              <p className="mt-1 text-xs leading-5 text-foreground/50">
                A JSON edit brief containing the real timeline, transcript,
                asset references, and accepted AI decisions. It does not claim
                to render an MP4.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void downloadEditBrief()}
              disabled={busyAction === "export-brief"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {busyAction === "export-brief" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {busyAction === "export-brief"
                ? "Preparing marked brief"
                : "Download edit brief"}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-foreground/40">
              <Clock3 className="h-3 w-3" />
              No rendered video has been produced.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
