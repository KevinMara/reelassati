import { useUiText } from "@/lib/i18n/ui";
import { isPrimaryFootage } from "@contracts/timeline-layers";
import { insertMotionKit } from "@/lib/motion-kits";
import { normalizeReview } from "@contracts/source-review";
import {
  EditStyleTemplates,
  SaveEditStyleTemplate,
} from "@/components/studio/EditStyleTemplates";
import {
  captureEditStyle,
  canCaptureEditStyle,
} from "@contracts/edit-style-template";
import { mapChatTranscript } from "@/lib/editor-chat-execution";
import { normalizeTranscriptWords } from "@contracts/transcript-timing";
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
import { ObjectTrackingPanel } from "@/components/studio/ObjectTrackingPanel";
import { ShotTransitionPanel } from "@/components/studio/ShotTransitionPanel";
import { TimelineMixer } from "@/components/studio/TimelineMixer";
import { RhythmTools } from "@/components/studio/RhythmTools";
import { ClipTimingTools } from "@/components/studio/ClipTimingTools";
import { TranscriptCutPanel } from "@/components/studio/TranscriptCutPanel";
import { SavedEditorStyles } from "@/components/studio/SavedEditorStyles";
import { ProjectFootageSearch } from "@/components/studio/ProjectFootageSearch";
import {
  addEditorSavedStyle,
  removeEditorSavedStyle,
  type EditorSavedStyle,
} from "@contracts/editor-style-library";
import { cutTranscriptWords } from "@/lib/transcript-cuts";
import {
  slipTimelineSource,
  rollTimelineCut,
  rateStretchTimelineClip,
} from "@/lib/editor-trimming";
import {
  expandLinkedSelection,
  groupClips,
  ungroupClips,
  linkClips,
  unlinkClips,
} from "@contracts/clip-groups";
import {
  loadEditorKeybindings,
  saveEditorKeybindings,
  matchEditorKeybinding,
  EDITOR_KEYBOARD_ACTIONS,
  type EditorActionId,
} from "@/lib/editor-keybindings";
import {
  updateTimelineTrack,
  reorderTimelineTrack,
} from "@contracts/timeline-mixer";
import {
  applyAdjacentTransition,
  removeAdjacentTransition,
  transitionFreeClip,
} from "@contracts/adjacent-transition";
import { EditorInfo } from "@/components/studio/EditorInfo";
import { EditorShortcuts } from "@/components/studio/EditorShortcuts";
import {
  replaceTimelineClip,
  splitClipGroup,
  toggleTimelineLane,
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
import { placeLibraryAsset } from "@/lib/library-insertion";
import { selectedBrand } from "@/lib/workspace-scope";

import { EditorPresetLibrary } from "@/components/studio/EditorPresetLibrary";
import {
  buildStoryBeatEvidence,
  storyBeatsAreCurrent,
} from "@contracts/story-beats";
import { StoryBeatStrip } from "@/components/studio/StoryBeatStrip";
import { TimelineTracks } from "@/components/studio/TimelineTracks";
import {
  clipLaneKind,
  clipLaneNumber,
  trimTimelineClip,
  normalizeClipTiming,
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
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  applyEditOperation,
  contentDuration,
  resizeTimeline,
  rippleDeleteSelection,
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
    frameRate: project.frameRate,
    trackSettings: structuredClone(project.trackSettings),
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
  const ui = useUiText();

  const {
    workspace,
    capabilities,
    loading,
    saving,
    error: workspaceError,
    updateWorkspace,
    getWorkspaceSnapshot,
  } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProject = workspace.projects.find(
    item => item.id === searchParams.get("project")
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    requestedProject?.id ?? null
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    requestedProject?.clips[0]?.id ?? null
  );
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
  const optimizationOpenedFor = useRef<string | null>(null);
  useEffect(() => {
    if (
      searchParams.get("optimize") !== "1" ||
      !requestedProject?.analyzerOptimization ||
      optimizationOpenedFor.current === requestedProject.id
    )
      return;
    optimizationOpenedFor.current = requestedProject.id;
    setSelectedProjectId(requestedProject.id);
    setAutoEditOpen(true);
  }, [
    requestedProject?.id,
    requestedProject?.analyzerOptimization,
    searchParams,
  ]);
  const [autoEditSummary, setAutoEditSummary] = useState("");
  const autoEditFinished = useRef(false);
  const libraryInsertLock = useRef(false);
  const [chatSeed, setChatSeed] = useState<{
    text: string;
    id: number;
    range?: { start: number; end: number };
  }>();
  const [clipDraft, setClipDraft] = useState<TimelineClip | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState<TranscriptSegment[]>(
    requestedProject?.transcript.map(segment => ({ ...segment })) ?? []
  );
  const captionCursors = useRef<Record<string, number>>({});
  const transcriptBase = useRef<{ projectId: string; value: string } | null>(
    null
  );
  const [transcriptConflict, setTranscriptConflict] = useState(false);
  const [titleDraft, setTitleDraft] = useState(requestedProject?.title ?? "");
  const [transcriptionProvenance, setTranscriptionProvenance] =
    useState<ContentProvenance | null>(
      requestedProject?.transcriptProvenance ?? null
    );
  const [rawPlayhead, setPlayhead] = useState(requestedProject?.playhead ?? 0);
  const [playing, setPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(100);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [findingSections, setFindingSections] = useState(false);
  const sectionsLock = useRef(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const [selectGroups, setSelectGroups] = useState(true);
  const [keybindings, setKeybindings] = useState(loadEditorKeybindings);
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
  const selectedIds =
    project && selectedClipId
      ? expandLinkedSelection(project, [selectedClipId, ...extraSelection], {
          groups: selectGroups,
          links: true,
        })
      : [];
  const selectedClips = (project?.clips ?? []).filter(c =>
    selectedIds.includes(c.id)
  );
  const selectionLocked = selectedClips.some(c => c.locked);
  const [draftSource, setDraftSource] = useState<TimelineClip | undefined>(
    undefined
  );
  if (draftSource !== selectedClip) {
    setDraftSource(selectedClip);
    setClipDraft(selectedClip ? { ...selectedClip } : null);
  }
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
  const [durationSource, setDurationSource] = useState<number | undefined>(
    undefined
  );
  if (durationSource !== project?.duration) {
    setDurationSource(project?.duration);
    setDurationDraft(null);
  }
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
              : transformed.clips.filter(c => !c.transitionHandle).length !==
                    item.clips.filter(c => !c.transitionHandle).length ||
                  transformed.clips
                    .filter(c => !c.transitionHandle)
                    .some(
                      (clip, index) =>
                        clip.id !==
                          item.clips.filter(c => !c.transitionHandle)[index]
                            ?.id ||
                        clip.start !==
                          item.clips.filter(c => !c.transitionHandle)[index]
                            ?.start ||
                        clip.duration !==
                          item.clips.filter(c => !c.transitionHandle)[index]
                            ?.duration
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
            frameRate: item.frameRate,
            trackSettings: item.trackSettings,
            storyBeats: item.storyBeats,
          }) ===
          JSON.stringify({
            clips: next.clips,
            transcript: next.transcript,
            duration: next.duration,
            captionStyle: next.captionStyle,
            captionAppearance: next.captionAppearance,
            aspectRatio: next.aspectRatio,
            frameRate: next.frameRate,
            trackSettings: next.trackSettings,
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

  const findStorySections = async () => {
    if (!project || sectionsLock.current) return;
    const projectId = project.id;
    const latest = () =>
      getWorkspaceSnapshot().projects.find(p => p.id === projectId);
    sectionsLock.current = true;
    setFindingSections(true);
    setLocalError(null);
    try {
      if (!buildStoryBeatEvidence(latest()!).length) {
        const mainClips = latest()!.clips.filter(isPrimaryFootage);
        const ids = [...new Set(mainClips.map(c => c.assetId).filter(Boolean))];
        const assets = getWorkspaceSnapshot().assets.filter(
          a => ids.includes(a.id) && a.kind === "video"
        );
        if (!assets.length)
          throw new Error(
            ui("Add source video or a transcript to find story sections.")
          );
        if (assets.length > 19)
          throw new Error(
            ui(
              "This timeline needs more source analysis than one request allows. Analyze the main footage first, then find sections."
            )
          );
        const { analyzeMedia } = await import("@/lib/analyze-media");
        for (const asset of assets) {
          const result = await analyzeMedia(
            asset,
            project.platform,
            "Identify the actual hook, main explanation, proof and payoff with measured source timestamps. Describe speech and visual content accurately; these observations will locate reference markers, not change the edit."
          );
          await updateWorkspace(w => ({
            ...w,
            projects: w.projects.map(p =>
              p.id !== projectId
                ? p
                : {
                    ...p,
                    sourceReviews: [
                      ...(p.sourceReviews ?? []).filter(
                        r => r.assetId !== asset.id
                      ),
                      {
                        assetId: asset.id,
                        reviewedAt: new Date().toISOString(),
                        summary: result.summary,
                        ...normalizeReview(result.review),
                        moments: result.retention,
                      },
                    ],
                  }
            ),
          }));
        }
      }
      const response = await platformApi.findStorySections(
        projectId,
        crypto.randomUUID()
      );
      const markerAction = response.actions.find(a => a.kind === "story-beats");
      if (!markerAction || markerAction.kind !== "story-beats")
        throw new Error(
          ui("No reliable story sections were found in this footage.")
        );
      await commitProject("Story sections found", p => {
        if (
          !storyBeatsAreCurrent(markerAction.beats, buildStoryBeatEvidence(p))
        )
          throw new Error(
            ui(
              "The footage changed while sections were being found. Refresh sections for the current edit."
            )
          );
        return { ...p, storyBeats: markerAction.beats };
      });
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "Could not find sections. Try again."
      );
    } finally {
      sectionsLock.current = false;
      setFindingSections(false);
    }
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
    const owner = workspace.profile.email.toLowerCase();
    const brand = selectedBrand(owner);
    asset = { ...asset, duration: await resolveMediaDuration(asset) };
    await updateWorkspace(current => {
      if (
        current.profile.email.toLowerCase() !== owner ||
        selectedBrand(owner) !== brand
      )
        throw new Error(
          ui("Your account or brand changed. Reopen the intended workspace.")
        );
      const target = current.projects.find(item => item.id === targetProjectId);
      if (!target) throw new Error(ui("The project is no longer available."));
      const timelineEnd = target.clips.reduce(
        (latest, clip) => Math.max(latest, clip.start + clip.duration),
        0
      );
      const start = Math.max(0, insertAt ?? timelineEnd);
      const clip = placeLibraryAsset(
        target,
        asset,
        createId("clip"),
        start,
        destination
      );
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
          const movingIds = expandLinkedSelection(
            current,
            selectedIds.includes(clip.id) ? selectedIds : [clip.id],
            { groups: selectGroups, links: true }
          );
          return moveClipGroup(
            current,
            movingIds,
            clip.id,
            time,
            destination.number
          );
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

  const addLibraryAssetAtPlayhead = async (
    asset: Asset,
    position: "playhead" | "end" = "playhead"
  ) => {
    if (!project || libraryInsertLock.current)
      throw new Error(ui("An insertion is already in progress."));
    libraryInsertLock.current = true;
    setBusyAction(`library-${asset.id}`);
    setLocalError(null);
    try {
      await addAssetToTimeline(
        asset,
        project.id,
        "Library media added",
        position === "end" ? undefined : playhead
      );
      setRecentlyAddedAssetId(asset.id);
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "The library asset could not be added."
      );
      throw cause;
    } finally {
      libraryInsertLock.current = false;
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
      text: ui,
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
            ),
            workspace.assets
          )
        ),
      "Clip timing could not be saved."
    );
  };

  const splitSelectedClip = async () => {
    if (!selectedClips.length || selectionLocked) return;
    let ids: string[] = [];
    const saved = await saveProjectChange(
      () =>
        commitProject("Selection split", current => {
          const result = splitClipGroup(current, selectedIds, playhead, () =>
            createId("clip")
          );
          ids = result.ids;
          return result.project;
        }),
      "The clip could not be split."
    );
    if (!saved) return;
    setSelectedClipId(ids[0]);
    setExtraSelection(ids.slice(1));
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

  const rippleDeleteSelected = async () => {
    if (!selectedClips.length || selectionLocked) return;
    const saved = await saveProjectChange(
      () =>
        commitProject("Ripple deleted selected time across all tracks", p =>
          rippleDeleteSelection(p, selectedIds)
        ),
      "The selected time could not be removed."
    );
    if (saved) {
      setSelectedClipId(null);
      setExtraSelection([]);
      setClipDraft(null);
    }
  };
  const nudgeSelection = async (delta: number) => {
    if (!selectedClip || selectionLocked) return;
    await saveProjectChange(
      () =>
        commitProject("Nudged selection", p => {
          const anchor = p.clips.find(c => c.id === selectedClip.id);
          if (!anchor) throw new Error(ui("Select a clip to nudge."));
          return moveClipGroup(
            p,
            selectedIds,
            anchor.id,
            anchor.start + delta,
            clipLaneNumber(anchor)
          );
        }),
      "Could not nudge the selection."
    );
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
          replaceTimelineClip(p, selectedClip.id, edited, workspace.assets)
        ),
      "Could not trim clip."
    );
  };
  const editMembership = async (
    kind: "group" | "ungroup" | "link" | "unlink"
  ) => {
    if (!selectedIds.length || selectionLocked) return;
    await saveProjectChange(
      () =>
        commitProject(`${kind} selection`, p =>
          kind === "group"
            ? groupClips(p, selectedIds, () => createId("group"))
            : kind === "ungroup"
              ? ungroupClips(p, selectedIds)
              : kind === "link"
                ? linkClips(p, selectedIds, () => createId("link"))
                : unlinkClips(p, selectedIds)
        ),
      "Could not change this selection’s group or link."
    );
  };
  const applySavedStyle = async (style: EditorSavedStyle) => {
    if (style.type === "look" && !selectedClip)
      throw new Error(ui("Select a video or image to apply this look."));
    await commitProject(`Applied saved style: ${style.name}`, p => {
      if (style.type === "captions")
        return {
          ...p,
          captionStyle: style.captionStyle,
          captionAppearance: structuredClone(style.captionAppearance),
        };
      if (style.type === "look") {
        const clip = p.clips.find(c => c.id === selectedClip?.id);
        if (
          !clip ||
          clip.graphic ||
          !clip.assetId ||
          clip.track === "audio" ||
          clip.track === "captions"
        )
          throw new Error(ui("Select a video or image to apply this look."));
        return replaceTimelineClip(
          p,
          clip.id,
          { ...clip, ...structuredClone(style.settings) },
          workspace.assets
        );
      }
      if (playhead >= p.duration)
        throw new Error(
          ui(
            "Move the playhead inside the edit before inserting a saved graphic."
          )
        );
      const id = createId("saved-graphic");
      const next = applyEditOperation(p, {
        id,
        type: "graphic",
        label: style.graphic.text || style.name,
        reason: "Applied saved editable graphic",
        start: playhead,
        end: Math.min(p.duration, playhead + style.graphicDuration),
        confidence: 1,
        intensity: "balanced",
        targetClipIds: [],
        status: "proposed",
        parameters: { graphic: structuredClone(style.graphic) },
      });
      return {
        ...next,
        clips: next.clips.map(c =>
          c.id === id ? { ...c, graphicDuration: style.graphicDuration } : c
        ),
      };
    });
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
      const actionId = matchEditorKeybinding(event, keybindings);
      if (!actionId) return;
      if (
        ["copy", "cut"].includes(actionId) &&
        window.getSelection()?.toString()
      )
        return;
      const needsClip: EditorActionId[] = [
        "copy",
        "cut",
        "duplicate",
        "delete",
        "rippleDelete",
        "nudgeLeft",
        "nudgeRight",
        "nudgeSecondLeft",
        "nudgeSecondRight",
        "split",
        "detachAudio",
        "mute",
        "lock",
        "trimStart",
        "trimEnd",
        "group",
        "ungroup",
        "link",
        "unlink",
      ];
      if (needsClip.includes(actionId) && !selectedClip) return;
      if (actionId === "paste" && !clipboardRef.current.length) return;
      const copySelection = () => {
        clipboardRef.current = structuredClone(
          selectedClips
            .filter(c => !c.transitionHandle)
            .map(c => transitionFreeClip(project, c))
        );
        clipboardTranscript.current = structuredClone(project.transcript);
      };
      const actions: Record<EditorActionId, () => void | Promise<unknown>> = {
        undo,
        redo,
        selectAll: () => {
          setSelectedClipId(
            project.clips.find(c => !c.transitionHandle)?.id ?? null
          );
          setExtraSelection(
            project.clips
              .slice(1)
              .filter(c => !c.transitionHandle)
              .map(c => c.id)
          );
        },
        copy: copySelection,
        cut: async () => {
          if (selectionLocked) return;
          copySelection();
          await deleteSelectedClip();
        },
        paste: pasteClip,
        duplicate: duplicateSelectedClip,
        delete: deleteSelectedClip,
        rippleDelete: rippleDeleteSelected,
        nudgeLeft: () => nudgeSelection(-1 / (project.frameRate ?? 30)),
        nudgeRight: () => nudgeSelection(1 / (project.frameRate ?? 30)),
        nudgeSecondLeft: () => nudgeSelection(-1),
        nudgeSecondRight: () => nudgeSelection(1),
        split: splitSelectedClip,
        detachAudio: detachSelectedAudio,
        lock: () => toggleClipProperty("locked"),
        mute: () => toggleClipProperty("muted"),
        trimStart: () => trimAtPlayhead("start"),
        trimEnd: () => trimAtPlayhead("end"),
        snapping: () => setSnapping(v => !v),
        start: () => seekTimeline(0),
        end: () => seekTimeline(project.duration),
        seekBackward: () => seekTimeline(playhead - 1),
        seekForward: () => seekTimeline(playhead + 1),
        secondBackward: () => seekTimeline(playhead - 1),
        secondForward: () => seekTimeline(playhead + 1),
        frameBackward: () =>
          seekTimeline(playhead - 1 / (project.frameRate ?? 30)),
        frameForward: () =>
          seekTimeline(playhead + 1 / (project.frameRate ?? 30)),
        play: toggleTimelinePlayback,
        zoomIn: () => setTimelineZoom(z => Math.min(1600, z * 1.25)),
        zoomOut: () => setTimelineZoom(z => Math.max(25, z / 1.25)),
        zoomFit: () => setTimelineZoom(100),
        deselect: () => {
          setSelectedClipId(null);
          setExtraSelection([]);
          setClipDraft(null);
        },
        library: openLibrary,
        inspector: () => setInspectorOpen(true),
        shortcuts: () => setShortcutsOpen(true),
        group: () => editMembership("group"),
        ungroup: () => editMembership("ungroup"),
        link: () => editMembership("link"),
        unlink: () => editMembership("unlink"),
      };
      const action = actions[actionId];
      event.preventDefault();
      if (
        (event.repeat &&
          !EDITOR_KEYBOARD_ACTIONS.find(row => row.id === actionId)?.repeat) ||
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
      setLocalError(ui("Correct the caption time ranges before saving."));
      return;
    }

    if (
      project &&
      transcriptBase.current?.projectId === project.id &&
      transcriptBase.current.value !== JSON.stringify(project.transcript)
    ) {
      setTranscriptConflict(true);
      setLocalError(
        ui(
          "Captions changed while you were editing. Load the saved captions before applying another revision."
        )
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
      const mapped = mapChatTranscript(
        project,
        previewAsset.id,
        result.segments
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
          {ui("Opening your studio")}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mono-eyebrow mb-2 text-primary">
              {ui("Editing studio")}
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">
              {ui("Start with footage. Keep control of every cut.")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
              {ui(
                "Build on a real timeline, then use AI for inspectable changes you can accept, reject, and undo."
              )}
            </p>
          </div>
          {workspace.projects.length > 0 && (
            <span className="text-xs text-foreground/70">
              {workspace.projects.length} {ui("saved")}{" "}
              {workspace.projects.length === 1 ? ui("project") : ui("projects")}
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
                <p className="mono-eyebrow text-primary">
                  {ui("Ready for Edit")}
                </p>
                <h2 className="mt-1 truncate font-medium">
                  {pendingAsset.name}
                </h2>
                <p className="mt-1 text-xs text-foreground/70">
                  {ui(
                    "Choose an existing project below or start a new timeline with this"
                  )}{" "}
                  {pendingAsset.kind} {ui("already placed.")}
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
                    ? ui("Adding…")
                    : ui("New edit with media")}
                </button>
                <button
                  type="button"
                  onClick={clearPendingAsset}
                  className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground/70 hover:text-foreground"
                >
                  {ui("Cancel")}
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
              ? ui("Drop files to start the edit")
              : ui("Upload footage to a new edit")}
          </span>
          <span className="mt-1 text-sm text-foreground/70">
            {ui("Drop video, image, or audio here, or click to choose.")}
          </span>
          {uploadProgress !== null && (
            <span className="mt-4 font-mono text-xs text-primary">
              {ui("Uploading")} {uploadProgress}%
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
          <h2 className="text-base font-medium">
            {ui("Start from a structure")}
          </h2>
          <span className="text-xs text-foreground/70">
            {ui("No irreversible auto-edit")}
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
              <span className="block font-medium">{ui(item.name)}</span>
              <span className="mt-2 block text-sm leading-5 text-foreground/70">
                {ui(item.description)}
              </span>
            </button>
          ))}
        </div>

        {workspace.projects.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-base font-medium">
              {ui("Saved projects")}
            </h2>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspace.projects.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    void (pendingAsset
                      ? addPendingAssetToProject(item)
                      : openProject(item))
                  }
                  className="min-w-0 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">
                      {item.title}
                    </span>
                    <span className="mono-eyebrow shrink-0 text-foreground/70">
                      {item.aspectRatio}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-foreground/70">
                    <span>
                      {item.clips.length} {ui("clips")}
                    </span>
                    <span>{formatTime(item.duration)}</span>
                    <span className="capitalize">{item.status}</span>
                    {pendingAsset ? (
                      <span className="ml-auto font-medium text-primary">
                        {ui("Add here")}
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
      <label className="text-sm" htmlFor="editor-project-frame-rate">
        {ui("Project frame rate")}
        <CompactSelect
          id="editor-project-frame-rate"
          aria-label={ui("Project frame rate")}
          value={String(project.frameRate ?? 30)}
          disabled={Boolean(busyAction)}
          options={[24, 25, 30, 60].map(value => ({
            value: String(value),
            label: `${value} fps`,
          }))}
          onValueChange={value =>
            void saveProjectChange(
              () =>
                commitProject("Changed project frame rate", p => ({
                  ...p,
                  frameRate: Number(value) as 24 | 25 | 30 | 60,
                })),
              "Could not change frame rate."
            )
          }
          className="mt-2"
        />
      </label>
      <button
        type="button"
        onClick={() => setMixerOpen(true)}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      >
        {ui("Tracks and audio mixer")}
      </button>
      <label className="flex items-center gap-2 text-sm">
        {ui("Video duration")}
        <input
          aria-label={ui("Total video duration in seconds")}
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
        {ui("Set end")}
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
        {ui("Fit to content")}
      </button>
    </div>
  );
  const looksContent = (
    <div className="space-y-4">
      <p className="text-sm text-foreground/65">
        {selectedClip
          ? ui("Apply to {{name}}", { name: selectedClip.label })
          : ui("Select a video or image on the timeline.")}
      </p>{" "}
      <EditorPresetLibrary
        mode="looks"
        disabled={!selectedClip || selectedClip?.locked || Boolean(busyAction)}
        onClipLook={preset =>
          void saveProjectChange(
            () =>
              commitProject(`Applied ${preset.name}`, current =>
                selectedClip
                  ? replaceTimelineClip(current, selectedClip.id, {
                      ...current.clips.find(c => c.id === selectedClip.id)!,
                      ...preset.settings,
                    })
                  : current
              ),
            "The look could not be applied."
          )
        }
        onFadePreset={settings =>
          void saveProjectChange(
            () =>
              commitProject("Applied clip transition", current =>
                selectedClip
                  ? replaceTimelineClip(current, selectedClip.id, {
                      ...current.clips.find(c => c.id === selectedClip.id)!,
                      ...settings,
                    })
                  : current
              ),
            "The transition could not be applied."
          )
        }
      />
      <ShotTransitionPanel
        clip={selectedClip ?? undefined}
        project={project}
        disabled={!selectedClip || selectionLocked || Boolean(busyAction)}
        onApply={async (incomingId, kind, duration) => {
          if (!selectedClip) return;
          await commitProject(`Applied ${kind} between shots`, p =>
            applyAdjacentTransition(
              p,
              workspace.assets,
              selectedClip.id,
              incomingId,
              kind,
              duration
            )
          );
        }}
        onRemove={async (outgoingId, incomingId) => {
          await commitProject("Removed shot transition", p =>
            removeAdjacentTransition(p, outgoingId, incomingId)
          );
        }}
      />
    </div>
  );
  const inspectorContent = (
    <div>
      <ClipInspector
        draft={clipDraft}
        time={playhead}
        onSeek={seekTimeline}
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
        tracking={
          selectedClip?.graphic && (
            <ObjectTrackingPanel
              key={`${selectedClip.id}:${JSON.stringify(selectedClip)}`}
              project={project}
              clip={selectedClip}
              assets={workspace.assets}
              onApply={async (result, expectedSource) => {
                const expectedGraphic = selectedClip;
                const expectedAspectRatio = project.aspectRatio;
                await commitProject(
                  "Applied observed region tracking",
                  current => {
                    const source = current.clips.find(
                      c => c.id === expectedSource.id
                    );
                    const graphic = current.clips.find(
                      c => c.id === expectedGraphic.id
                    );
                    if (
                      !graphic ||
                      graphic.locked ||
                      current.aspectRatio !== expectedAspectRatio ||
                      JSON.stringify(source) !==
                        JSON.stringify(expectedSource) ||
                      JSON.stringify(graphic) !==
                        JSON.stringify(expectedGraphic)
                    )
                      throw new Error(
                        ui(
                          "The source or graphic changed during tracking. Track the current version again."
                        )
                      );
                    return {
                      ...current,
                      clips: current.clips.map(c =>
                        c.id === graphic.id ? result : c
                      ),
                    };
                  }
                );
              }}
            />
          )
        }
      />
      {selectedClip &&
        !selectedClip.graphic &&
        previewAsset &&
        (["video", "audio"].includes(previewAsset.kind) ||
          (previewAsset.kind === "export" &&
            previewAsset.contentType.startsWith("video/"))) && (
          <ClipTimingTools
            key={`${selectedClip.id}:${selectedClip.duration}`}
            project={project}
            clip={selectedClip}
            disabled={Boolean(busyAction) || selectionLocked}
            onApply={async (mode, value) => {
              await saveProjectChange(
                () =>
                  commitProject(
                    mode === "slip"
                      ? "Slipped source window"
                      : mode === "roll"
                        ? "Rolled adjacent cut"
                        : "Rate stretched clip",
                    p =>
                      mode === "slip"
                        ? slipTimelineSource(
                            p,
                            selectedClip.id,
                            value,
                            workspace.assets
                          )
                        : mode === "roll"
                          ? rollTimelineCut(
                              p,
                              selectedClip.id,
                              value,
                              workspace.assets
                            )
                          : rateStretchTimelineClip(
                              p,
                              selectedClip.id,
                              value,
                              workspace.assets
                            )
                  ),
                "Could not change the clip timing."
              );
            }}
          />
        )}
    </div>
  );
  const captionsContent = (
    <>
      <TranscriptCutPanel
        project={project}
        assets={workspace.assets}
        busy={Boolean(busyAction)}
        canRestore={
          revisionCursor > 0 &&
          project.revisions[revisionCursor]?.label ===
            "Removed selected transcript words"
        }
        onRestore={undo}
        onCut={async selections => {
          const saved = await saveProjectChange(
            () =>
              commitProject("Removed selected transcript words", p =>
                cutTranscriptWords(p, workspace.assets, selections)
              ),
            "Could not cut the selected words."
          );
          if (saved) {
            setSelectedClipId(null);
            setExtraSelection([]);
          }
        }}
      />
      {
        <div>
          <details className="mb-4 rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {ui("Caption style library")}
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
              <p className="mono-eyebrow text-primary">
                {ui("Editable transcript")}
              </p>
              <h2 className="mt-2 text-lg font-medium">
                {ui("Words are edit points")}
              </h2>
            </div>
            <button
              type="button"
              onClick={addTranscriptSegment}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-background"
              aria-label={ui("Add transcript line")}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {transcriptConflict && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
            >
              {ui(
                "Captions changed while you had an unsaved draft. Your draft is kept here for comparison."
              )}
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
                {ui("Load saved captions")}
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
              {ui("Transcribe active media")}
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
                    aria-label={ui("Line {{number}} start", {
                      number: index + 1,
                    })}
                  />
                  <span className="text-xs text-foreground/70">{ui("to")}</span>
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
                    aria-label={ui("Line {{number}} end", {
                      number: index + 1,
                    })}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      mutateTranscript(current =>
                        current.filter(item => item.id !== segment.id)
                      )
                    }
                    className="ml-auto text-foreground/70 hover:text-destructive"
                    aria-label={ui("Delete line {{number}}", {
                      number: index + 1,
                    })}
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
                  placeholder={ui("Type the spoken line")}
                  onChange={event =>
                    mutateTranscript(current =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              text: event.target.value,
                              words: normalizeTranscriptWords(
                                event.target.value,
                                item.words
                              ),
                            }
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
                    {ui("Preview")}
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
                    {ui("Split at playhead")}
                  </button>
                  <EditorInfo label={ui("Split a caption")}>
                    {ui(
                      "Place the playhead at the spoken break, then put the text cursor before the next phrase. Split keeps those words and uses your chosen time; it does not guess word timing."
                    )}
                  </EditorInfo>
                  {index < transcriptDraft.length - 1 && (
                    <button
                      type="button"
                      disabled={
                        segment.sourceClipId !==
                        transcriptDraft[index + 1]?.sourceClipId
                      }
                      title={
                        segment.sourceClipId !==
                        transcriptDraft[index + 1]?.sourceClipId
                          ? ui(
                              "Keep captions from different source clips separate."
                            )
                          : undefined
                      }
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
                      {ui("Merge next")}
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
              {ui(
                "Add lines manually or transcribe the selected media when the speech service is connected."
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => void saveTranscript()}
            className="mt-4 w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {ui("Save transcript revision")}
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
          aria-label={ui("Back to projects")}
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
            aria-label={ui("Project title")}
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
            {saving
              ? ui("Saving")
              : workspaceError
                ? ui("Save failed")
                : ui("Saved")}
          </span>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {ui("Export video")}
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
            aria-label={ui("Dismiss error")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {autoEditSummary && (
        <div>
          <div
            role="status"
            className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm"
          >
            <span className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              {autoEditSummary}
            </span>
            <button
              type="button"
              aria-label={ui("Close")}
              onClick={() => setAutoEditSummary("")}
            >
              <X className="size-4" />
            </button>
          </div>
          {canCaptureEditStyle(project) && (
            <div className="mb-4">
              <SaveEditStyleTemplate
                profile={captureEditStyle(project)}
                source="edit"
                disabled={Boolean(busyAction)}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)] md:items-start xl:grid-cols-[minmax(240px,0.85fr)_minmax(300px,1.35fr)_minmax(310px,1fr)]">
        <section
          id="editor-media-panel"
          className="min-w-0 max-h-[560px] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface md:col-start-1 md:row-start-1 md:h-[540px] xl:h-[620px] xl:max-h-none"
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
            onMotionKit={async draft => {
              const identity = createId("motion-kit");
              await commitProject("Added motion kit", p =>
                insertMotionKit(p, workspace.assets, draft, playhead, identity)
              );
              setSelectedClipId(`${identity}-${draft.logoAssetId ? 1 : 0}`);
              setExtraSelection([]);
            }}
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
          <details className="border-t border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {ui("Search project footage")}
            </summary>
            <div className="mt-4">
              <ProjectFootageSearch
                project={project}
                assets={workspace.assets}
                onSelect={(clipId, time) => {
                  setSelectedClipId(clipId);
                  setExtraSelection([]);
                  seekTimeline(time);
                }}
              />
            </div>
          </details>
          <details className="border-t border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {ui("Saved graphics and styles")}
            </summary>
            <div className="mt-4">
              <div className="mb-4">
                <EditStyleTemplates
                  project={project}
                  disabled={Boolean(busyAction)}
                />
              </div>
              <SavedEditorStyles
                styles={workspace.editorStyles ?? []}
                selectedClip={selectedClip}
                project={project}
                time={playhead}
                disabled={Boolean(busyAction)}
                onSave={async draft => {
                  await updateWorkspace(w => ({
                    ...w,
                    editorStyles: addEditorSavedStyle(w.editorStyles, {
                      ...draft,
                      id: createId("style"),
                    }),
                  }));
                }}
                onDelete={async id => {
                  await updateWorkspace(w => ({
                    ...w,
                    editorStyles: removeEditorSavedStyle(w.editorStyles, id),
                  }));
                }}
                onApply={applySavedStyle}
              />
            </div>
          </details>
        </section>
        <main className="contents">
          <section
            {...previewDrop.dropZoneProps}
            className={`relative min-w-0 overflow-hidden rounded-xl border md:col-start-2 md:row-start-1 md:h-[540px] xl:h-[620px] bg-[#0D0C0E] shadow-card transition-all ${
              previewDrop.isDragging
                ? "border-[#A894FF] ring-4 ring-[#A894FF]/20"
                : "border-white/5"
            }`}
          >
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/60 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A894FF]" />
              {ui("Timeline preview")}
            </div>
            <div
              className={`relative flex h-[400px] touch-none items-center justify-center overflow-hidden p-5 md:h-[410px] xl:h-[490px] ${previewZoom > 100 ? "cursor-grab active:cursor-grabbing" : ""}`}
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
                  {ui("Drop media into this edit")}
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
                aria-label={
                  playing ? ui("Pause timeline") : ui("Play timeline")
                }
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
                aria-label={ui("Playhead")}
              />
              <span className="w-20 text-right font-mono text-xs text-white/40">
                {formatTime(project.duration)}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-surface px-3 py-2 text-sm text-foreground">
              <CompactSelect
                aria-label={ui("Preview aspect ratio")}
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
                    {previewZoom === 100 ? ui("Fit") : `${previewZoom}%`}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 rounded-xl">
                  <p className="mb-3 text-sm font-semibold">
                    {ui("Preview zoom")}
                  </p>
                  <input
                    type="range"
                    min={25}
                    max={400}
                    step={5}
                    value={previewZoom}
                    aria-label={ui("Preview zoom")}
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
                        {value === 100 ? ui("Fit") : `${value}%`}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-foreground/65">
                    {ui(
                      "Zoom is for inspecting your edit. Drag the enlarged preview to pan. Export framing stays unchanged."
                    )}
                  </p>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => setInspectorOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm"
              >
                <SlidersHorizontal className="size-4" /> {ui("Adjust")}
              </button>
            </div>
          </section>

          <section
            id="editor-timeline-panel"
            tabIndex={-1}
            {...timelineDrop.dropZoneProps}
            className={`min-w-0 overflow-hidden rounded-xl border bg-surface shadow-card md:col-span-2 md:row-start-2 xl:col-span-3 transition-all ${
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
                {ui("Upload")}
              </button>
              <span className="mx-3 text-xs text-foreground/45">
                {ui("or")}
              </span>
              <button
                type="button"
                onClick={openLibrary}
                disabled={Boolean(busyAction)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Library className="h-3.5 w-3.5" />
                {ui("Add from library")}
              </button>
              <span className="mx-1 h-5 w-px bg-border" />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-xs font-medium hover:bg-background"
                  >
                    {ui("Groups and links")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-2">
                  <button
                    type="button"
                    aria-pressed={selectGroups}
                    onClick={() => {
                      setSelectGroups(value => !value);
                      setExtraSelection([]);
                    }}
                    className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm"
                  >
                    {ui("Select grouped clips:")}{" "}
                    {selectGroups ? ui("On") : ui("Off")}
                  </button>
                  {(["group", "ungroup", "link", "unlink"] as const).map(
                    kind => (
                      <button
                        key={kind}
                        type="button"
                        disabled={
                          Boolean(busyAction) ||
                          selectionLocked ||
                          !selectedIds.length ||
                          (["group", "link"].includes(kind) &&
                            selectedIds.length < 2)
                        }
                        onClick={() => void editMembership(kind)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm capitalize hover:bg-background disabled:opacity-40"
                      >
                        {kind} {ui("selection")}
                      </button>
                    )
                  )}
                  <p className="text-xs text-foreground/65">
                    {ui(
                      "Linked video and audio move and trim together. Unlink to edit them independently."
                    )}
                  </p>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => setMixerOpen(true)}
                className="rounded-lg px-3 py-2 text-xs font-medium hover:bg-background"
              >
                {ui("Tracks and mixer")}
              </button>
              <button
                type="button"
                onClick={() => setRhythmOpen(true)}
                disabled={Boolean(busyAction)}
                className="rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-40"
              >
                {ui("Beat cuts and zoom")}
              </button>

              <button
                type="button"
                disabled={!selectedClips.length || selectionLocked}
                title={ui("Split at playhead")}
                onClick={() => void splitSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-30"
              >
                <Scissors className="h-3.5 w-3.5" />
                {ui("Split")}
              </button>
              <button
                type="button"
                disabled={!selectedClip}
                title={ui("Duplicate selection")}
                onClick={() => void duplicateSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-30"
              >
                <Copy className="h-3.5 w-3.5" />
                {ui("Duplicate")}
              </button>
              <button
                type="button"
                disabled={!selectedClips.length || selectionLocked}
                title={ui("Delete selection")}
                onClick={() => void deleteSelectedClip()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {ui("Delete")}
                {selectedClips.length > 1 ? ` (${selectedClips.length})` : ""}
              </button>
              <button
                type="button"
                disabled={!selectedClips.length || selectionLocked}
                title={ui(
                  "Remove the selected time intervals across all unlocked tracks and close the gaps"
                )}
                onClick={() => void rippleDeleteSelected()}
                className="rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-30"
              >
                {ui("Ripple delete")}
              </button>

              <div className="ml-auto flex items-center gap-2 pr-1">
                <button
                  type="button"
                  disabled={revisionCursor <= 0}
                  onClick={() => void undo()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-foreground/70 hover:text-foreground disabled:opacity-30"
                  aria-label={ui("Undo")}
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={revisionCursor >= project.revisions.length - 1}
                  onClick={() => void redo()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-foreground/70 hover:text-foreground disabled:opacity-30"
                  aria-label={ui("Redo")}
                >
                  <Redo2 className="h-4 w-4" />
                </button>

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
                  aria-label={ui("Timeline zoom")}
                  aria-valuetext={`${Math.round(timelineZoom)}%`}
                />
                <button
                  type="button"
                  onClick={() => setTimelineZoom(100)}
                  className="rounded-md px-2 py-1 text-xs text-foreground/65 hover:bg-background"
                >
                  {ui("Fit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShortcutsOpen(true)}
                  title={ui("Keyboard shortcuts (Ctrl/⌘ + /)")}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs"
                >
                  <Keyboard className="size-4" />
                  <span className="hidden sm:inline">{ui("Shortcuts")}</span>
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
              busy={findingSections}
              onGenerate={() => void findStorySections()}
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
              onTrackToggle={async (lane, property) => {
                await saveProjectChange(
                  () =>
                    commitProject(
                      `Changed ${lane.kind} ${lane.number} ${property}`,
                      p => toggleTimelineLane(p, lane, property)
                    ),
                  "The track’s clips could not be changed."
                );
              }}
              selectedClipId={selectedClipId}
              selectedClipIds={selectedIds}
              disabled={Boolean(busyAction)}
              onSeek={seekTimeline}
              onSelect={(clip, time, additive) => {
                const related = expandLinkedSelection(project, [clip.id], {
                  groups: selectGroups,
                  links: true,
                });
                if (additive && selectedIds.includes(clip.id)) {
                  const remaining = selectedIds.filter(
                    id => !related.includes(id)
                  );
                  setSelectedClipId(remaining[0] ?? null);
                  setExtraSelection(remaining.slice(1));
                } else {
                  setSelectedClipId(clip.id);
                  setExtraSelection(
                    additive
                      ? [...new Set([...selectedIds, ...related])].filter(
                          id => id !== clip.id
                        )
                      : related.filter(id => id !== clip.id)
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
                  text: ui,
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
                      replaceTimelineClip(
                        current,
                        clip.id,
                        clip,
                        workspace.assets
                      )
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
          className="min-w-0 overflow-hidden rounded-xl border border-primary/20 bg-surface md:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-start-1 xl:h-[620px]"
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

      <EditorShortcuts
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        bindings={keybindings}
        onChange={next => {
          setKeybindings(next);
          if (!saveEditorKeybindings(next))
            setLocalError(
              ui(
                "These shortcuts work for this session, but this browser could not save them."
              )
            );
        }}
      />
      <Dialog open={rhythmOpen} onOpenChange={setRhythmOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>{ui("Beat cuts and speech zoom")}</DialogTitle>
          <DialogDescription>
            {ui("Measure existing audio and make reversible rhythm edits.")}
          </DialogDescription>
          <RhythmTools
            key={project.id}
            project={project}
            assets={workspace.assets}
            selectedIds={selectedIds}
            onSeek={seekTimeline}
            onCommit={async (label, transform) => {
              await commitProject(label, transform);
              setRhythmOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={mixerOpen} onOpenChange={setMixerOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>{ui("Tracks and audio mixer")}</DialogTitle>
          <DialogDescription>
            {ui("Rename, reorder and mix the tracks in this project.")}
          </DialogDescription>
          <TimelineMixer
            project={project}
            disabled={Boolean(busyAction)}
            onUpdate={async (lane, patch) => {
              await saveProjectChange(
                () =>
                  commitProject("Updated track settings", p =>
                    updateTimelineTrack(p, lane, patch)
                  ),
                "Could not update this track."
              );
            }}
            onReorder={async (lane, direction) => {
              await saveProjectChange(
                () =>
                  commitProject("Reordered tracks", p =>
                    reorderTimelineTrack(p, lane, direction)
                  ),
                "Could not reorder tracks."
              );
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>{ui("Adjust")}</DialogTitle>
          <DialogDescription>
            {ui("Clip settings, canvas and the end of your edit.")}
          </DialogDescription>
          {clipDraft && (
            <div className="rounded-xl border border-border bg-black p-3">
              <div className="mx-auto max-w-[280px]">
                <TimelinePreview
                  project={{
                    ...project,
                    clips: project.clips.map(c =>
                      c.id === clipDraft.id ? clipDraft : c
                    ),
                  }}
                  assets={workspace.assets}
                  time={Math.min(
                    playhead,
                    clipDraft.start + clipDraft.duration - 0.0001
                  )}
                  playing={false}
                />
              </div>
              <label className="mt-3 flex items-center gap-3 text-sm text-white">
                <span className="tabular-nums">{playhead.toFixed(1)}s</span>
                <input
                  aria-label={ui("Adjustment preview time")}
                  type="range"
                  min={0}
                  max={project.duration}
                  step={1 / (project.frameRate ?? 30)}
                  value={playhead}
                  onChange={e => seekTimeline(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </label>
            </div>
          )}
          {inspectorContent}
        </DialogContent>
      </Dialog>

      <Dialog open={autoEditOpen} onOpenChange={setAutoEditOpen}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"
          onCloseAutoFocus={event => {
            if (!autoEditFinished.current) return;
            event.preventDefault();
            autoEditFinished.current = false;
            const timeline = document.getElementById("editor-timeline-panel");
            timeline?.focus({ preventScroll: true });
            timeline?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <DialogTitle>{ui("AI auto-edit")}</DialogTitle>
          <DialogDescription>
            {ui(
              "Build a complete edit from your footage and a reference style."
            )}
          </DialogDescription>
          <AutonomousEditor
            key={project.id}
            project={project}
            onFinished={summary => {
              setAutoEditSummary(summary);
              autoEditFinished.current = true;
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
