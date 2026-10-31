import { composerToken, rankComposerCommands } from "@/lib/composer-commands";
import { creditReceiptTotal } from "@contracts/credit-receipt";
import { ConciseResponse } from "./ConciseResponse";
import { editorChatReceipt } from "@/lib/editor-chat-receipt";
import { persistedAutonomousReceipt } from "@/lib/autonomous-result-receipt";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useUiText } from "@/lib/i18n/ui";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  ArrowUp,
  Maximize2,
  Minimize2,
  AtSign,
  Brain,
  ClipboardList,
  Check,
  Circle,
  CircleAlert,
  Clock3,
  Film,
  Image,
  Link2,
  Loader2,
  Music2,
  Paperclip,
  Plus,
  Scissors,
  SkipForward,
  Sparkles,
  Square,
  Subtitles,
  WandSparkles,
  X,
} from "lucide-react";
import {
  EDITOR_ASSISTANT_NAME,
  type EditorChatAction,
  type EditorChatMessage,
  type EditorChatReference,
} from "@contracts/editor-chat";
import { editorChatRunStatus } from "@contracts/editor-chat";
import {
  EDITOR_TASK_PRESETS,
  editorTaskPreset,
  type EditorTaskPresetId,
} from "@contracts/editor-chat-presets";
import type { EditProject } from "@contracts/workspace";
import { useEditorChat } from "./useEditorChat";
import { canChooseChatAction } from "@/lib/editor-chat-safety";
import {
  editorChatTargetContext,
  type EditorChatTimeTarget,
} from "@/lib/editor-chat-target";
import { useWorkspace } from "@/providers/workspace";
import { cn } from "@/lib/utils";
import { CompactSelect } from "@/components/ui/compact-select";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TimeRange = { start: number; end: number };
type Props = {
  project: EditProject;
  playhead: number;
  selectedClipId?: string | null;
  seed?: {
    text: string;
    id: number;
    range?: TimeRange;
    section?: { id: string; label: string };
    ranges?: TimeRange[];
    sections?: import("@contracts/story-beats").StoryBeat[];
  };
  onSeek: (time: number) => void;
  onAutoEdit: () => void;
  onBusyChange?: (busy: boolean) => void;
  externalBusy?: boolean;
  hasAutoActivity?: boolean;
  resultTools?: ReactNode;
  onFindSections?: () => void;
  findingSections?: boolean;
};

const STARTERS = [
  {
    icon: Subtitles,
    label: "Add captions",
    preset: "captions",
  },
  {
    icon: WandSparkles,
    label: "Create a graphic",
    preset: "motion",
  },
  {
    icon: Film,
    label: "Match a reference",
    preset: "reference",
  },
  {
    icon: Scissors,
    label: "Shape the story",
    preset: "story",
  },
] as const;
const ACCEPT_FILES =
  "image/*,video/*,audio/*,text/plain,application/pdf,.pdf,.md,.json,.csv,.srt,.vtt";
const LIBRARY_DRAG_TYPE = "application/x-reelassati-asset-id";

function fitComposer(node: HTMLTextAreaElement) {
  if (node.dataset.expanded === "true") {
    node.style.height = "";
    return;
  }
  node.style.height = "auto";
  if (node.value) node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
}

function seconds(value: number) {
  return `${value.toFixed(1)}s`;
}
function referenceKey(ref: EditorChatReference) {
  return "assetId" in ref
    ? `asset:${ref.assetId}`
    : "url" in ref
      ? `url:${ref.url}`
      : `text:${ref.name}:${ref.text}`;
}
function actionStateLabel(
  action: EditorChatAction,
  ui: ReturnType<typeof useUiText>
) {
  const labels = {
    pending: ui("Queued"),
    "awaiting-approval": ui("Your choice"),
    running: ui("Working"),
    completed: ui("Done"),
    skipped: ui("Skipped"),
    failed: ui("Needs attention"),
    blocked: ui("Paused"),
    interrupted: ui("Interrupted"),
  };
  if (
    action.status === "interrupted" &&
    action.kind === "generate" &&
    action.runtime?.jobId
  )
    return ui("Generating");
  return labels[action.status];
}

export function EditorChat({
  project,
  playhead,
  selectedClipId,
  seed,
  onSeek,
  onAutoEdit,
  onBusyChange,
  externalBusy = false,
  hasAutoActivity = false,
  resultTools,
  onFindSections,
  findingSections,
}: Props) {
  const ui = useUiText();
  const chat = useEditorChat(project, { onSeek });
  useEffect(() => {
    onBusyChange?.(chat.busy);
  }, [chat.busy, onBusyChange]);
  const { workspace } = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [taskPreset, setTaskPreset] = useState<EditorTaskPresetId>();
  const [executionMode, setExecutionMode] = useState<"plan" | "execute">(
    "execute"
  );
  const [excludedClip, setExcludedClip] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [caret, setCaret] = useState(0);
  const [commandIndex, setCommandIndex] = useState(0);
  const [dismissedToken, setDismissedToken] = useState<string>();
  const [timeTarget, setTimeTarget] = useState<EditorChatTimeTarget>();
  const contextClip =
    !timeTarget && selectedClipId !== excludedClip
      ? project.clips.find(c => c.id === selectedClipId)
      : undefined;
  const [references, setReferences] = useState<EditorChatReference[]>([]);
  const targetContext = editorChatTargetContext(timeTarget, contextClip?.id);
  const range = targetContext.range;
  const referenceItems = targetContext.sectionReference
    ? [...references, targetContext.sectionReference]
    : references;
  const [attachBusy, setAttachBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [effort, setEffort] = useState<"balanced" | "max">("max");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeDraft, setRangeDraft] = useState({
    start: 0,
    end: project.duration,
  });
  const [budgetDraft, setBudgetInput] = useState<string | null>(null);
  const budgetInput = budgetDraft ?? String(chat.state.maxCredits);
  const [workingChoice, setWorkingChoice] = useState<string>();
  const [selectedActions, setSelectedActions] = useState<Set<string>>(
    new Set()
  );
  const input = useRef<HTMLTextAreaElement>(null);
  const referenceTrigger = useRef<HTMLButtonElement>(null);
  const pendingReferencePopover = useRef<"range" | "url" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const [lastSeed, setLastSeed] = useState<number>();
  const dragDepth = useRef(0);
  const [previousProjectId, setPreviousProjectId] = useState(project.id);

  if (previousProjectId !== project.id) {
    setPreviousProjectId(project.id);
    setPrompt("");
    setTaskPreset(undefined);
    setExcludedClip(undefined);
    setReferences([]);
    setTimeTarget(undefined);
    setLocalError("");
    setLastSeed(undefined);
    setSelectedActions(new Set());
    setBudgetInput(null);
  } else if (seed && seed.id !== lastSeed) {
    setLastSeed(seed.id);
    if (seed.text) setPrompt(seed.text);
    setTimeTarget(
      seed.range
        ? {
            range: seed.range,
            section: seed.section,
            ranges: seed.ranges,
            sections: seed.sections,
          }
        : undefined
    );
  }
  useEffect(() => {
    if (seed) input.current?.focus();
  }, [seed]);

  useLayoutEffect(() => {
    if (input.current) fitComposer(input.current);
  }, [prompt, project.id, expanded]);
  useEffect(() => {
    const node = input.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let width = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === width) return;
      width = node.clientWidth;
      fitComposer(node);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (followLatest.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [chat.state.messages, chat.busy]);

  function refLabel(ref: EditorChatReference) {
    if ("assetId" in ref)
      return (
        workspace.assets.find(asset => asset.id === ref.assetId)?.name ??
        "Library file"
      );
    if ("name" in ref)
      return /\.pdf$/i.test(ref.name) ? `${ref.name} · text only` : ref.name;
    try {
      return new URL(ref.url).hostname;
    } catch {
      return ref.url;
    }
  }
  function addReferences(incoming: EditorChatReference[]) {
    setReferences(current => {
      const found = new Set(current.map(referenceKey));
      return [
        ...current,
        ...incoming.filter(
          ref => !found.has(referenceKey(ref)) && !!found.add(referenceKey(ref))
        ),
      ];
    });
  }
  async function attach(files: File[]) {
    if (!files.length) return;
    if (attachBusy) {
      setLocalError(
        ui("Let the current files finish uploading before adding more.")
      );
      return;
    }
    if (references.length + files.length > 8) {
      setLocalError(
        ui("Attach up to 8 references per message. Remove one to make room.")
      );
      return;
    }
    setLocalError("");
    setAttachBusy(true);
    try {
      addReferences(await chat.attachFiles(files));
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "This file could not be attached. Try again."
      );
    } finally {
      setAttachBusy(false);
    }
  }
  function supportedDrop(event: DragEvent) {
    return (
      event.dataTransfer.types.includes("Files") ||
      event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)
    );
  }
  function drop(event: DragEvent) {
    if (!supportedDrop(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    const assetId = event.dataTransfer.getData(LIBRARY_DRAG_TYPE);
    if (assetId && workspace.assets.some(asset => asset.id === assetId))
      addReferences([{ assetId }]);
    else if (event.dataTransfer.files.length)
      void attach(Array.from(event.dataTransfer.files));
  }
  function addLink() {
    try {
      const parsed = new URL(referenceUrl.trim());
      if (parsed.protocol !== "https:" || parsed.username || parsed.password)
        throw new Error();
      addReferences([{ url: parsed.href }]);
      setReferenceUrl("");
      setUrlOpen(false);
      setLocalError("");
      input.current?.focus();
    } catch {
      setLocalError(ui("Enter a complete public https:// reference link."));
    }
  }
  function restoreReferenceTriggerFocus(event: Event) {
    event.preventDefault();
    // Keep focus on the composer after applying, or on an outside control.
    if (document.activeElement === document.body)
      referenceTrigger.current?.focus();
  }
  async function runChoice(id: string, callback: () => Promise<void>) {
    if (externalBusy || chat.busy || workingChoice) return;
    setLocalError("");
    setWorkingChoice(id);
    try {
      await callback();
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "The action could not finish. Your work is saved."
      );
    } finally {
      setWorkingChoice(undefined);
    }
  }
  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text || externalBusy || chat.busy || attachBusy || workingChoice)
      return;
    if (references.length > 8) {
      setLocalError(
        ui("Attach up to 8 references per message. Remove one to make room.")
      );
      return;
    }
    const textReferences = references.filter(
      (ref): ref is { name: string; text: string } => "text" in ref
    );
    if (
      textReferences.some(ref => ref.text.length > 16000) ||
      textReferences.reduce((sum, ref) => sum + ref.text.length, 0) > 40000
    ) {
      setLocalError(
        ui(
          "Shorten text references to 16,000 characters each and 40,000 total before sending."
        )
      );
      return;
    }
    setLocalError("");
    followLatest.current = true;
    const sentRefs = referenceItems;
    const sentAttachments = references;
    const sentTarget = timeTarget;
    const sentPreset = taskPreset;
    setPrompt("");
    setReferences([]);
    setTimeTarget(undefined);
    setTaskPreset(undefined);
    try {
      const submitted = await chat.send(
        text,
        sentRefs,
        targetContext.range,
        targetContext.selectedClipIds,
        {
          taskPreset: sentPreset,
          executionMode,
          effort,
          ranges: targetContext.ranges,
        }
      );
      if (!submitted) {
        setPrompt(current => current || text);
        addReferences(sentAttachments);
        setTimeTarget(sentTarget);
        setTaskPreset(sentPreset);
      }
    } catch (error) {
      setPrompt(current => current || text);
      addReferences(sentAttachments);
      setTimeTarget(sentTarget);
      setTaskPreset(sentPreset);
      setLocalError(
        error instanceof Error
          ? error.message
          : "Your message could not be sent. Please try again."
      );
    }
  }
  function starter(id: EditorTaskPresetId) {
    setTaskPreset(id);
    input.current?.focus();
  }
  const token = composerToken(prompt, caret);
  const tokenKey = token
    ? `${token.start}:${token.trigger}:${token.query}`
    : "";
  const commandChoices =
    token?.trigger === "+"
      ? [
          {
            id: "files",
            label: ui("Attach reference files"),
          },
          {
            id: "link",
            label: ui("Attach a reference link"),
          },
          {
            id: "range",
            label: ui("Edit around the playhead"),
          },
          {
            id: "sections",
            label: ui("Find sections"),
          },
        ]
      : [
          {
            id: "plan",
            label: ui("Plan before editing"),
          },
          ...EDITOR_TASK_PRESETS.filter(p => p.id !== "range").map(p => ({
            id: p.id,
            label: ui(p.label),
          })),
        ];
  const commands =
    token &&
    tokenKey !== dismissedToken &&
    !externalBusy &&
    !attachBusy &&
    !chat.busy &&
    !findingSections
      ? rankComposerCommands(commandChoices, token.query)
      : [];
  const activeCommand = Math.min(
    commandIndex,
    Math.max(0, commands.length - 1)
  );
  function chooseCommand(index: number) {
    const command = commands[index];
    if (!command || !token) return;
    setPrompt(prompt.slice(0, token.start) + prompt.slice(token.end));
    setCaret(token.start);
    setDismissedToken(tokenKey);
    setCommandIndex(0);
    if (token.trigger === "+") {
      if (command.id === "files") fileInput.current?.click();
      else if (command.id === "link") setUrlOpen(true);
      else if (command.id === "sections") onFindSections?.();
      else if (command.id === "range") {
        const start = Math.max(0, Math.min(playhead, project.duration - 0.1));
        setRangeDraft({ start, end: Math.min(project.duration, start + 5) });
        setRangeOpen(true);
      }
    } else if (command.id === "plan") setExecutionMode("plan");
    else {
      const preset = EDITOR_TASK_PRESETS.find(p => p.id === command.id);
      if (preset) starter(preset.id);
    }
  }

  const busyChoice =
    externalBusy ||
    chat.busy ||
    attachBusy ||
    findingSections ||
    !!workingChoice;
  const error = localError || chat.error;

  return (
    <section
      aria-label={ui("{{name}} editing chat", { name: EDITOR_ASSISTANT_NAME })}
      className="reel-chat relative flex h-full min-h-0 flex-col overflow-hidden bg-surface"
      onDragEnter={event => {
        if (supportedDrop(event)) {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }
      }}
      onDragOver={event => {
        if (supportedDrop(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={event => {
        if (supportedDrop(event)) {
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }
      }}
      onDrop={drop}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1">
        <div className="min-w-0 shrink-0">
          <h2 className="text-sm font-semibold">{EDITOR_ASSISTANT_NAME}</h2>
          <p className="text-[11px] text-foreground/50">
            {ui("Your editing partner")}
          </p>
        </div>
        {!busyChoice && (
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onAutoEdit}
              title={ui("AI auto-edit")}
              className="ai-magic flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold"
            >
              <Sparkles className="size-4 shrink-0" />{" "}
              <span className="truncate">{ui("AI auto-edit")}</span>
            </button>
            <button
              type="button"
              aria-pressed={executionMode === "plan"}
              onClick={() => {
                setExecutionMode(current =>
                  current === "plan" ? "execute" : "plan"
                );
                input.current?.focus();
              }}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-sm",
                executionMode === "plan"
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border text-foreground/70 hover:bg-foreground/5"
              )}
            >
              <ClipboardList className="size-4" /> {ui("Plan")}
            </button>
          </div>
        )}
      </header>

      <div
        ref={scroller}
        data-chat-conversation
        onScroll={() => {
          const node = scroller.current;
          if (node)
            followLatest.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 90;
        }}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4",
          expanded && "hidden"
        )}
        aria-label={ui("Conversation")}
      >
        {project.proposedChanges.some(
          change => change.status === "proposed"
        ) && (
          <details className="mb-4 rounded-xl border border-border bg-background/35 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {ui("Saved suggestions ·")}{" "}
              {
                project.proposedChanges.filter(
                  change => change.status === "proposed"
                ).length
              }
            </summary>
            <p className="mt-2 text-xs text-foreground/60">
              {ui(
                "Earlier analysis suggestions are still available to review."
              )}
            </p>
            {project.proposedChanges
              .filter(change => change.status === "proposed")
              .map(change => (
                <div
                  key={change.id}
                  className="mt-3 border-t border-border pt-3"
                >
                  <p className="text-sm font-medium">{change.label}</p>
                  <p className="mt-1 text-xs text-foreground/60">
                    {change.reason}
                  </p>
                  <button
                    type="button"
                    className="my-2 text-xs text-primary"
                    onClick={() => onSeek(change.start)}
                  >
                    {seconds(change.start)}–{seconds(change.end)}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyChoice}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
                      onClick={() =>
                        void runChoice(change.id, () =>
                          chat.reviewSavedSuggestion(change.id, true)
                        )
                      }
                    >
                      {ui("Apply change")}
                    </button>
                    <button
                      type="button"
                      disabled={busyChoice}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
                      onClick={() =>
                        void runChoice(change.id, () =>
                          chat.reviewSavedSuggestion(change.id, false)
                        )
                      }
                    >
                      {ui("Reject")}
                    </button>
                  </div>
                </div>
              ))}
          </details>
        )}
        {!chat.state.messages.length && !hasAutoActivity ? (
          <div className="reel-empty flex min-h-full flex-col justify-center py-1">
            <h3 className="text-xs font-medium text-muted-foreground">
              {ui("What are we making?")}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {STARTERS.map(item => (
                <button
                  key={item.preset}
                  type="button"
                  onClick={() => starter(item.preset)}
                  className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2 text-left text-[11px] text-foreground/75 transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <item.icon className="size-3.5 shrink-0 text-muted-foreground" />
                  {ui(item.label)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {chat.state.messages
              .filter(
                message =>
                  !(
                    externalBusy &&
                    message.activity?.kind === "auto-edit" &&
                    message.status === "running"
                  )
              )
              .map(message => (
                <div
                  key={message.id}
                  className={cn("min-w-0", message.role === "user" && "ml-5")}
                >
                  {message.role === "user" ? (
                    <div className="rounded-2xl rounded-tr-sm bg-primary/12 px-3 py-2.5">
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.text}
                      </p>
                      {(!!message.inputDetails?.length ||
                        !!message.request) && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-foreground/65">
                            {ui("Your instructions")}
                          </summary>
                          <dl className="mt-2 space-y-2 border-t border-border pt-2">
                            {message.inputDetails?.map((detail, index) => (
                              <div key={index}>
                                <dt className="font-medium text-foreground/60">
                                  {detail.label}
                                </dt>
                                <dd className="mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                                  {detail.value}
                                </dd>
                              </div>
                            ))}
                            {message.request && (
                              <>
                                <div>
                                  <dt className="text-foreground/60">
                                    {ui("Plan")}
                                  </dt>
                                  <dd>
                                    {ui(
                                      message.request.executionMode === "plan"
                                        ? "Plan first"
                                        : "Automatic"
                                    )}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-foreground/60">
                                    {ui("Reel effort")}
                                  </dt>
                                  <dd>
                                    {ui(
                                      message.request.effort === "balanced"
                                        ? "Balanced"
                                        : "Maximum"
                                    )}
                                  </dd>
                                </div>
                                {(message.request.ranges?.length ||
                                  message.request.range) && (
                                  <div>
                                    <dt className="text-foreground/60">
                                      {ui("Time range")}
                                    </dt>
                                    <dd>
                                      {(message.request.ranges?.length
                                        ? message.request.ranges
                                        : [message.request.range!]
                                      )
                                        .map(
                                          range =>
                                            `${range.start.toFixed(1)}–${range.end.toFixed(1)}s`
                                        )
                                        .join(", ")}
                                    </dd>
                                  </div>
                                )}
                                {!!message.request.selectedClipIds?.length && (
                                  <div>
                                    <dt className="text-foreground/60">
                                      {ui("Selected clip")}
                                    </dt>
                                    <dd>
                                      {message.request.selectedClipIds
                                        .map(
                                          id =>
                                            project.clips.find(
                                              clip => clip.id === id
                                            )?.label ?? id
                                        )
                                        .join(", ")}
                                    </dd>
                                  </div>
                                )}
                              </>
                            )}
                          </dl>
                        </details>
                      )}
                      {!!message.references?.length && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.references.map((ref, index) => (
                            <span
                              key={index}
                              title={refLabel(ref)}
                              className="inline-flex max-w-full items-center gap-1 rounded-md bg-background/60 px-2 py-1 text-[10px] text-foreground/60"
                            >
                              <Paperclip className="size-3 shrink-0" />
                              <span className="truncate">{refLabel(ref)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {message.request?.taskPreset && (
                        <p className="mt-2 text-xs text-primary">
                          {ui(
                            editorTaskPreset(message.request.taskPreset)
                              ?.label ?? ""
                          )}
                          {message.request.executionMode === "plan"
                            ? ui(" · Plan first")
                            : ""}
                        </p>
                      )}
                      {message.range && (
                        <button
                          type="button"
                          onClick={() => onSeek(message.range!.start)}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary"
                        >
                          <Clock3 className="size-3" />
                          {seconds(message.range.start)}–
                          {seconds(message.range.end)}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-foreground/55">
                        <Sparkles className="size-3 text-primary" />
                        {EDITOR_ASSISTANT_NAME}
                      </div>
                      {message.text && (
                        <ConciseResponse
                          text={
                            persistedAutonomousReceipt(message, project, ui) ??
                            editorChatReceipt(message, ui) ??
                            message.text
                          }
                          detailsText={
                            message.activity?.kind === "auto-edit" &&
                            message.status === "completed"
                              ? message.activity.planSummary
                                ? `${ui("Plan")}: ${message.activity.planSummary}`
                                : message.activity.appliedTypes === undefined
                                  ? `${ui("Plan")}: ${message.text}`
                                  : undefined
                              : editorChatReceipt(message, ui)
                                ? `${ui("Plan")}: ${message.text}`
                                : undefined
                          }
                        />
                      )}
                      {message.status === "planning" && (
                        <div
                          role="status"
                          className="ai-status-text mt-3 flex items-center gap-2 text-xs"
                        >
                          <Loader2 className="size-3.5 animate-spin" />
                          {ui("Reading your request and project…")}
                        </div>
                      )}
                      {!!message.plan?.actions.length && (
                        <div className="mt-3 space-y-2">
                          {message.plan.actions.filter(canChooseChatAction)
                            .length > 1 && (
                            <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span>
                                  {
                                    message.plan.actions.filter(
                                      a =>
                                        canChooseChatAction(a) &&
                                        selectedActions.has(a.id)
                                    ).length
                                  }{" "}
                                  {ui("selected")}
                                </span>
                                <button
                                  type="button"
                                  className="text-primary"
                                  onClick={() =>
                                    setSelectedActions(current => {
                                      const next = new Set(current);
                                      const eligible =
                                        message.plan!.actions.filter(
                                          canChooseChatAction
                                        );
                                      const all = eligible.every(a =>
                                        next.has(a.id)
                                      );
                                      eligible.forEach(a =>
                                        all ? next.delete(a.id) : next.add(a.id)
                                      );
                                      return next;
                                    })
                                  }
                                >
                                  {ui("Select all / clear")}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(["approve", "skip"] as const).map(
                                  decision => (
                                    <button
                                      key={decision}
                                      type="button"
                                      disabled={
                                        busyChoice ||
                                        !message.plan!.actions.some(
                                          a =>
                                            canChooseChatAction(a) &&
                                            selectedActions.has(a.id)
                                        )
                                      }
                                      className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-2 text-xs text-primary disabled:opacity-40"
                                      onClick={() =>
                                        void runChoice(
                                          `batch:${message.id}`,
                                          async () => {
                                            const decisions =
                                              Object.fromEntries(
                                                message
                                                  .plan!.actions.filter(
                                                    canChooseChatAction
                                                  )
                                                  .map(a => [
                                                    a.id,
                                                    selectedActions.has(a.id)
                                                      ? decision
                                                      : decision === "approve"
                                                        ? "skip"
                                                        : "approve",
                                                  ])
                                              );
                                            await chat.decide(
                                              message.id,
                                              decisions
                                            );
                                            setSelectedActions(new Set());
                                          }
                                        )
                                      }
                                    >
                                      {decision === "approve"
                                        ? ui("Include selected · skip rest")
                                        : ui("Skip selected · include rest")}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                          {message.plan.actions
                            .filter(
                              action =>
                                !["completed", "skipped"].includes(
                                  action.status
                                )
                            )
                            .map(action => (
                              <ActionCard
                                key={action.id}
                                action={action}
                                busy={busyChoice}
                                choiceBusy={busyChoice}
                                selected={selectedActions.has(action.id)}
                                onSelect={() =>
                                  setSelectedActions(current => {
                                    const next = new Set(current);
                                    if (next.has(action.id))
                                      next.delete(action.id);
                                    else next.add(action.id);
                                    return next;
                                  })
                                }
                                working={workingChoice === action.id}
                                onApprove={() =>
                                  void runChoice(action.id, () =>
                                    chat.approve(message.id, action.id)
                                  )
                                }
                                onSkip={() =>
                                  void runChoice(action.id, () =>
                                    chat.skip(message.id, action.id)
                                  )
                                }
                                onRecover={() =>
                                  void runChoice(action.id, () =>
                                    chat.recover(message.id, action.id)
                                  )
                                }
                              />
                            ))}
                        </div>
                      )}
                      {!!message.plan?.actions.some(action =>
                        ["completed", "skipped"].includes(action.status)
                      ) && (
                        <details className="mt-3 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">
                            {
                              message.plan.actions.filter(action =>
                                ["completed", "skipped"].includes(action.status)
                              ).length
                            }{" "}
                            {ui("steps")}
                          </summary>
                          <ol className="mt-2 space-y-2 border-l border-border pl-3">
                            {message.plan.actions
                              .filter(action =>
                                ["completed", "skipped"].includes(action.status)
                              )
                              .map(action => (
                                <li
                                  key={action.id}
                                  className="flex items-center gap-2"
                                >
                                  {action.status === "skipped" ? (
                                    <SkipForward size={12} />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  {action.label}
                                  {action.status === "skipped" && (
                                    <span className="text-foreground/40">
                                      · {ui("Skipped")}
                                    </span>
                                  )}
                                </li>
                              ))}
                          </ol>
                        </details>
                      )}
                      {!!message.plan?.blockedReasons.length && (
                        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-foreground/70">
                          {message.plan.blockedReasons.map(reason => (
                            <p key={reason} className="not-first:mt-2">
                              {reason}
                            </p>
                          ))}
                        </div>
                      )}
                      <RunControls
                        message={message}
                        busy={busyChoice}
                        onResume={(newCap, applyPlan) =>
                          void runChoice(`resume:${message.id}`, () =>
                            chat.resume(message.id, newCap, applyPlan)
                          )
                        }
                      />
                      {message.status !== "planning" &&
                        message.status !== "running" &&
                        message.plan &&
                        editorChatRunStatus(
                          message.plan.actions,
                          message.plan.blockedReasons
                        ) === "failed" && (
                          <p
                            role="status"
                            className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-300"
                          >
                            <CircleAlert className="size-3.5" />
                            {message.plan.actions.some(
                              a => a.status === "completed"
                            )
                              ? ui("Partly completed · review the steps above")
                              : ui("Needs attention · review the steps above")}
                          </p>
                        )}
                      {!!message.activity?.steps.length && (
                        <details className="mt-3 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">
                            {message.activity.steps.length} {ui("steps")}
                          </summary>
                          <ol className="mt-2 space-y-2 border-l border-border pl-3">
                            {message.activity.steps.map((step, index) => (
                              <li
                                key={index}
                                className="flex items-start gap-2"
                              >
                                <Check className="mt-0.5 size-3 shrink-0" />
                                {step}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                      <div
                        className="mt-2 flex items-center gap-1 text-[10px] leading-none text-foreground/40"
                        title={ui("Credits used")}
                      >
                        <span aria-hidden="true">·</span>
                        <span>
                          {message.creditReceiptsComplete === true &&
                          !["planning", "running"].includes(
                            message.status ?? ""
                          ) &&
                          !message.creditReceipts?.some(
                            receipt => receipt.status === "reserved"
                          )
                            ? creditReceiptTotal(message.creditReceipts)
                            : "…"}{" "}
                          cr
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
        <div id="editor-autoedit-activity" />
        {resultTools}
      </div>

      <div
        data-chat-composer
        className={cn(
          "relative border-t border-border p-2",
          expanded ? "flex min-h-0 flex-1 flex-col" : "shrink-0"
        )}
      >
        {error && (
          <p
            role="alert"
            className="mb-2 flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs text-destructive"
          >
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}
        <form
          onSubmit={event => void send(event)}
          className={cn(
            "relative flex flex-col rounded-xl border border-border bg-background/65 p-2 focus-within:border-primary/55",
            expanded && "min-h-0 flex-1"
          )}
        >
          {(range || contextClip || taskPreset || executionMode === "plan") && (
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-primary">
              {range && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 py-1 pl-1.5 pr-1">
                  <Clock3 className="size-3" />
                  {(targetContext.ranges ?? [range])
                    .map(r => `${seconds(r.start)}–${seconds(r.end)}`)
                    .join(" · ")}
                  <button
                    type="button"
                    aria-label={ui("Remove time range")}
                    onClick={() => setTimeTarget(undefined)}
                    className="rounded p-0.5 hover:bg-primary/10"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {executionMode === "plan" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs">
                  <ClipboardList className="size-3" /> {ui("Plan first")}
                  <button
                    type="button"
                    aria-label={ui("Exit planning mode")}
                    onClick={() => setExecutionMode("execute")}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {taskPreset && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs">
                  <WandSparkles className="size-3" />
                  {ui(editorTaskPreset(taskPreset)?.label ?? "")}
                  <button
                    type="button"
                    aria-label={ui("Remove task preset")}
                    onClick={() => setTaskPreset(undefined)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {contextClip && (
                <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs">
                  <span className="truncate" title={contextClip.label}>
                    {ui("Target:")}{" "}
                    {contextClip.graphic?.text || contextClip.label}
                  </span>
                  <button
                    type="button"
                    aria-label={ui("Remove clip from chat context")}
                    onClick={() => setExcludedClip(contextClip.id)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
          )}
          {!!referenceItems.length && (
            <div className="mb-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {referenceItems.map((ref, index) => (
                <span
                  key={referenceKey(ref)}
                  className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] text-foreground/70"
                >
                  <Paperclip className="size-3 shrink-0" />
                  <span className="max-w-36 truncate" title={refLabel(ref)}>
                    {refLabel(ref)}
                  </span>
                  <button
                    type="button"
                    aria-label={ui("Remove {{name}}", { name: refLabel(ref) })}
                    onClick={() => {
                      if (index === references.length) setTimeTarget(undefined);
                      else
                        setReferences(current =>
                          current.filter((_, i) => i !== index)
                        );
                    }}
                    className="rounded p-0.5 hover:bg-foreground/10"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {commands.length > 0 && (
            <div
              id="reel-composer-commands"
              role="listbox"
              aria-label={ui("Reel commands")}
              className={cn(
                "absolute left-0 right-0 z-50 max-h-60 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-xl",
                expanded ? "top-8" : "bottom-full mb-2"
              )}
            >
              {commands.map((command, index) => (
                <button
                  type="button"
                  role="option"
                  id={`reel-command-${command.id}`}
                  key={command.id}
                  aria-selected={index === activeCommand}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => chooseCommand(index)}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-xs",
                    index === activeCommand
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-foreground/5"
                  )}
                >
                  {command.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            aria-label={ui(expanded ? "Collapse composer" : "Expand composer")}
            onClick={() => {
              setExpanded(v => !v);
              input.current?.focus();
            }}
            className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded text-foreground/45 hover:bg-foreground/5 hover:text-foreground"
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <textarea
            ref={input}
            data-expanded={expanded}
            aria-controls={
              commands.length ? "reel-composer-commands" : undefined
            }
            aria-activedescendant={
              commands[activeCommand]
                ? `reel-command-${commands[activeCommand].id}`
                : undefined
            }
            aria-label={ui("Message Reel")}
            placeholder={
              taskPreset
                ? ui(editorTaskPreset(taskPreset)?.hint ?? "")
                : executionMode === "plan"
                  ? ui(
                      "Describe the result. Reel will make a plan for you to review…"
                    )
                  : ui("Ask Reel to edit your video…")
            }
            value={prompt}
            onChange={event => {
              setPrompt(event.target.value);
              setCaret(event.target.selectionStart);
              setCommandIndex(0);
              setDismissedToken(undefined);
            }}
            onSelect={event => setCaret(event.currentTarget.selectionStart)}
            rows={2}
            onKeyDown={event => {
              if (commands.length && !event.nativeEvent.isComposing) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setCommandIndex(
                    (activeCommand +
                      (event.key === "ArrowDown" ? 1 : commands.length - 1)) %
                      commands.length
                  );
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setDismissedToken(tokenKey);
                  return;
                }
                if (
                  (event.key === "Enter" && !event.shiftKey) ||
                  event.key === "Tab"
                ) {
                  event.preventDefault();
                  chooseCommand(activeCommand);
                  return;
                }
              }
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
            className={cn(
              "block w-full resize-none border-0 bg-transparent pr-6 font-sans text-xs font-normal leading-5 tracking-normal outline-none placeholder:text-foreground/40",
              expanded ? "min-h-0 flex-1" : "max-h-32 min-h-10"
            )}
          />
          <div className="relative flex items-center gap-1 sm:gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  ref={referenceTrigger}
                  type="button"
                  aria-label={ui("Add a reference or time range")}
                  disabled={attachBusy || externalBusy}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/5 disabled:opacity-40 "
                >
                  {attachBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                onCloseAutoFocus={event => {
                  const nextPopover = pendingReferencePopover.current;
                  if (!nextPopover) return;
                  pendingReferencePopover.current = null;
                  // Finish closing the menu before the popover takes focus.
                  event.preventDefault();
                  if (nextPopover === "range") setRangeOpen(true);
                  else setUrlOpen(true);
                }}
                className="w-60 rounded-xl border-border bg-surface p-1.5 text-foreground"
              >
                <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                  <Paperclip />
                  {ui("Attach reference files")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    pendingReferencePopover.current = "url";
                  }}
                >
                  <Link2 />
                  {ui("Attach a reference link")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={project.duration <= 0}
                  onSelect={() => {
                    const start = Math.max(
                      0,
                      Math.min(playhead, project.duration - 0.1)
                    );
                    setRangeDraft({
                      start,
                      end: Math.min(project.duration, start + 5),
                    });
                    pendingReferencePopover.current = "range";
                  }}
                >
                  <Clock3 />
                  {ui("Edit around the playhead")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={busyChoice || findingSections || !onFindSections}
                  onSelect={onFindSections}
                >
                  <Scissors />
                  {ui(findingSections ? "Finding sections…" : "Find sections")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={ui("Reel modes")}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/5 hover:text-foreground "
                >
                  <AtSign className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-60 rounded-xl border-border bg-surface p-1.5"
              >
                {" "}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setExecutionMode("plan");
                    input.current?.focus();
                  }}
                >
                  <ClipboardList /> {ui("Plan before editing")}
                </DropdownMenuItem>
                {EDITOR_TASK_PRESETS.filter(
                  preset => preset.id !== "range"
                ).map(preset => (
                  <Tooltip key={preset.id} delayDuration={1000}>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem onSelect={() => starter(preset.id)}>
                        {preset.id === "captions" ? (
                          <Subtitles />
                        ) : preset.id === "image" ? (
                          <Image />
                        ) : preset.id === "audio" ? (
                          <Music2 />
                        ) : preset.id === "reference" ? (
                          <Film />
                        ) : preset.id === "story" ? (
                          <Scissors />
                        ) : (
                          <WandSparkles />
                        )}
                        {ui(preset.label)}
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      sideOffset={8}
                      className="max-w-64 text-xs leading-relaxed"
                    >
                      {ui(preset.hint)}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
              <PopoverAnchor asChild>
                <span
                  className="pointer-events-none absolute bottom-0 left-0 size-0"
                  aria-hidden="true"
                />
              </PopoverAnchor>
              <PopoverContent
                side="top"
                align="start"
                onCloseAutoFocus={restoreReferenceTriggerFocus}
                className="w-72 space-y-3 rounded-xl bg-surface"
              >
                <h3 className="text-sm font-semibold">{ui("Time range")}</h3>
                {(["start", "end"] as const).map(edge => (
                  <label key={edge} className="block text-xs">
                    {ui(edge === "start" ? "Start" : "End")}
                    <input
                      type="range"
                      min={0}
                      max={project.duration}
                      step={0.1}
                      value={rangeDraft[edge]}
                      onChange={e =>
                        setRangeDraft(current => ({
                          ...current,
                          [edge]: Number(e.target.value),
                        }))
                      }
                      className="mt-2 w-full accent-primary"
                    />
                    <input
                      type="number"
                      min={0}
                      max={project.duration}
                      step={0.1}
                      aria-label={ui(
                        edge === "start" ? "Range start" : "Range end"
                      )}
                      value={rangeDraft[edge]}
                      onChange={e =>
                        setRangeDraft(current => ({
                          ...current,
                          [edge]: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-background px-2 py-1"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  disabled={
                    !Number.isFinite(rangeDraft.start) ||
                    !Number.isFinite(rangeDraft.end) ||
                    rangeDraft.start < 0 ||
                    rangeDraft.end > project.duration ||
                    rangeDraft.start >= rangeDraft.end
                  }
                  onClick={() => {
                    setTimeTarget({ range: rangeDraft });
                    setRangeOpen(false);
                    input.current?.focus();
                  }}
                  className="w-full rounded-lg bg-primary py-2 text-xs text-primary-foreground"
                >
                  {ui("Use range")}
                </button>
              </PopoverContent>
            </Popover>

            <Popover open={urlOpen} onOpenChange={setUrlOpen}>
              <PopoverAnchor asChild>
                <span
                  className="pointer-events-none absolute bottom-0 left-0 size-0"
                  aria-hidden="true"
                />
              </PopoverAnchor>
              <PopoverContent
                side="top"
                align="start"
                onCloseAutoFocus={restoreReferenceTriggerFocus}
                className="w-72 rounded-xl border-border bg-surface text-foreground"
              >
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="reel-reference-url"
                >
                  {ui("Reference link")}
                </label>
                <input
                  id="reel-reference-url"
                  type="url"
                  value={referenceUrl}
                  onChange={event => setReferenceUrl(event.target.value)}
                  placeholder="https://…"
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addLink();
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
                />
                <p className="mt-2 text-[11px] leading-relaxed text-foreground/50">
                  {ui(
                    "Use a public link. Upload the file if the source requires sign-in."
                  )}
                </p>
                <button
                  type="button"
                  onClick={addLink}
                  className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  {ui("Attach link")}
                </button>
              </PopoverContent>
            </Popover>
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={ui("Reel effort and extras")}
                  title={ui("Reel effort and extras")}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/5 hover:text-foreground "
                >
                  <Brain className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 rounded-xl border-border bg-surface text-foreground"
              >
                <p className="mb-2 text-xs text-muted-foreground">
                  {ui(
                    "Maximum spends more time checking the edit. Extras follow your approval setting and credit limit."
                  )}
                </p>
                <CompactSelect
                  aria-label={ui("Reel effort")}
                  value={effort}
                  onValueChange={value =>
                    setEffort(value === "balanced" ? "balanced" : "max")
                  }
                  options={[
                    { value: "balanced", label: ui("Balanced") },
                    { value: "max", label: ui("Maximum") },
                  ]}
                />
                <h3 className="mb-3 mt-4 text-sm font-semibold">
                  {ui("How Reel works")}
                </h3>
                <p className="mb-1.5 block text-xs text-foreground/60">
                  {ui("Optional improvements")}
                </p>
                <CompactSelect
                  aria-label={ui("Approval mode")}
                  value={chat.state.mode}
                  disabled={busyChoice}
                  onValueChange={value =>
                    void runChoice("preferences", () =>
                      chat.setPreferences({
                        mode: value === "auto" ? "auto" : "ask",
                      })
                    )
                  }
                  options={[
                    { value: "ask", label: "Ask before extras" },
                    { value: "auto", label: "Approve extras automatically" },
                  ]}
                />
                <p className="mt-2 text-xs leading-relaxed text-foreground/55">
                  {ui(
                    "Requested edits and their necessary steps run directly."
                  )}{" "}
                  {chat.state.mode === "ask"
                    ? ui(
                        "You choose whether to include additional suggestions."
                      )
                    : ui(
                        "Reel can include extra improvements within your credit limit."
                      )}
                </p>
                <label
                  className="mb-1.5 mt-4 block text-xs text-foreground/60"
                  htmlFor="reel-credit-limit"
                >
                  {ui("Credit limit per request")}
                </label>
                <div className="flex gap-2">
                  <input
                    id="reel-credit-limit"
                    type="number"
                    min={5}
                    max={10000}
                    step={1}
                    value={budgetInput}
                    disabled={busyChoice}
                    onChange={event => setBudgetInput(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm"
                  />
                  <button
                    type="button"
                    disabled={
                      busyChoice ||
                      !Number.isInteger(Number(budgetInput)) ||
                      Number(budgetInput) < 5 ||
                      Number(budgetInput) > 10000
                    }
                    onClick={() =>
                      void runChoice("preferences", async () => {
                        await chat.setPreferences({
                          maxCredits: Number(budgetInput),
                        });
                        setSettingsOpen(false);
                      })
                    }
                    className="rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    {ui("Save")}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-foreground/45">
                  {ui(
                    "Includes the 5-credit planning step and any paid actions. Approval mode never raises this limit."
                  )}
                </p>
              </PopoverContent>
            </Popover>
            <span className="ml-auto" />
            {chat.busy ? (
              <button
                type="button"
                onClick={chat.stop}
                aria-label={ui("Stop after current action")}
                title={ui("Stop after current action")}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!prompt.trim() || attachBusy || busyChoice}
                aria-label={ui("Send to Reel")}
                title={ui("Send to Reel")}
                className="ai-magic flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </form>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT_FILES}
          className="hidden"
          aria-label={ui("Attach reference files")}
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void attach(files);
          }}
        />
      </div>
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/95 p-6">
          <div className="text-center">
            <Paperclip className="mx-auto mb-3 size-7 text-primary" />
            <p className="text-sm font-medium">
              {ui("Drop a reference for Reel")}
            </p>
            <p className="mt-1 text-xs text-foreground/50">
              {ui("Files stay attached to your message.")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function ActionCard({
  action,
  busy,
  working,
  onApprove,
  onSkip,
  onRecover,
  choiceBusy,
  selected,
  onSelect,
}: {
  action: EditorChatAction;
  busy: boolean;
  working: boolean;
  onApprove: () => void;
  onSkip: () => void;
  onRecover: () => void;
  choiceBusy: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const ui = useUiText();
  const needsChoice = canChooseChatAction(action);
  const recoverable =
    ["interrupted", "failed"].includes(action.status) &&
    (action.kind === "catalog-audio" ||
      (action.kind === "generate" &&
        !!(action.runtime?.generationId || action.runtime?.jobId)) ||
      (action.kind === "replan" && !!action.runtime?.request) ||
      (action.kind === "transcribe" && !!action.runtime?.result));
  const Icon =
    action.status === "completed"
      ? Check
      : action.status === "running" || working
        ? Loader2
        : action.status === "skipped"
          ? SkipForward
          : ["failed", "blocked", "interrupted"].includes(action.status)
            ? CircleAlert
            : Circle;
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        needsChoice
          ? "border-primary/35 bg-primary/5"
          : "border-border bg-background/35"
      )}
    >
      <div className="flex items-start gap-2">
        {needsChoice ? (
          <input
            type="checkbox"
            aria-label={ui("Select {{name}}", { name: action.label })}
            checked={selected}
            onChange={onSelect}
            className="mt-1 size-4 shrink-0 appearance-none rounded-full border border-foreground/35 checked:border-primary checked:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          />
        ) : (
          <Icon
            className={cn(
              "mt-0.5 size-3.5 shrink-0",
              action.status === "running" || working
                ? "animate-spin text-primary"
                : action.status === "completed"
                  ? "text-emerald-500"
                  : "text-foreground/40"
            )}
          />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-medium leading-relaxed",
              action.status === "running" && "ai-status-text"
            )}
          >
            {action.label}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-foreground/45">
            <span>{actionStateLabel(action, ui)}</span>
            <span>
              {action.credits
                ? ui("{{credits}} credits", { credits: action.credits })
                : ui("No AI credits")}
            </span>
          </div>
        </div>
      </div>
      {action.runtime?.detail && (
        <p
          className="mt-2 break-words text-[11px] leading-relaxed text-foreground/55"
          role={action.status === "running" ? "status" : undefined}
        >
          {action.runtime.detail}
        </p>
      )}

      {action.error && (
        <p className="mt-2 break-words text-[11px] leading-relaxed text-destructive">
          {action.error}
        </p>
      )}
      {needsChoice ? (
        <div className="mt-2.5">
          <p className="text-xs leading-relaxed text-foreground/65">
            {action.reason ||
              "Reel suggests this additional improvement. Would you like to include it?"}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={choiceBusy || action.runtime?.approved}
              onClick={onApprove}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              {action.runtime?.approved
                ? ui("Included · queued")
                : action.credits
                  ? ui("Include it · {{credits}} cr", {
                      credits: action.credits,
                    })
                  : ui("Include it")}
            </button>
            <button
              type="button"
              disabled={choiceBusy}
              onClick={onSkip}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-foreground/5 disabled:opacity-40"
            >
              {ui("Skip")}
            </button>
          </div>
        </div>
      ) : (
        action.reason && (
          <details className="mt-2 text-[11px] text-foreground/45">
            <summary className="cursor-pointer select-none">
              {ui("Why this step")}
            </summary>
            <p className="mt-1.5 leading-relaxed">{action.reason}</p>
          </details>
        )
      )}
      {recoverable && (
        <button
          type="button"
          disabled={busy}
          onClick={onRecover}
          className="mt-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-primary disabled:opacity-40"
        >
          {action.kind === "catalog-audio"
            ? ui("Retry free sound")
            : ui("Check {{type}}", {
                type:
                  action.kind === "generate"
                    ? action.media === "speech"
                      ? ui("voiceover")
                      : action.media === "sfx"
                        ? ui("sound effect")
                        : ui(action.media)
                    : action.kind === "transcribe"
                      ? ui("saved captions")
                      : ui("saved plan"),
              })}
        </button>
      )}
      {action.status === "interrupted" && (
        <p className="mt-2 text-[10px] leading-relaxed text-foreground/45">
          {ui("Interrupted work is not automatically submitted again.")}
        </p>
      )}
    </div>
  );
}

function RunControls({
  message,
  busy,
  onResume,
}: {
  message: EditorChatMessage;
  busy: boolean;
  onResume: (cap?: number, applyPlan?: boolean) => void;
}) {
  const ui = useUiText();
  const plan = message.plan;
  if (!plan)
    return message.request && message.status !== "planning" ? (
      <button
        type="button"
        disabled={busy}
        onClick={() => onResume()}
        className="mt-3 rounded-lg border border-border px-3 py-2 text-sm text-primary disabled:opacity-40"
      >
        {ui("Recover saved plan")}
      </button>
    ) : null;
  const budget = message.maxCredits ?? plan.maxCredits;
  const quotedTotal =
    (message.usedCredits ?? plan.planCredits) +
    plan.actions
      .filter(a => ["pending", "awaiting-approval"].includes(a.status))
      .reduce((sum, a) => sum + a.credits, 0);
  const needsBudget = quotedTotal > budget;
  const remaining = plan.actions.some(action => action.status === "pending");
  if (needsBudget)
    return (
      <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
        <p className="text-xs font-medium">
          {ui("This plan needs a higher limit")}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground/60">
          {ui("Up to")} {quotedTotal}{" "}
          {ui("credits including planning. Your current limit is")} {budget}
          {ui(". Raising it does not approve optional extras.")}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onResume(quotedTotal, message.request?.executionMode === "plan")
          }
          className="mt-2 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          {ui("Set limit to")} {quotedTotal} &{" "}
          {message.request?.executionMode === "plan" && !message.planApproved
            ? ui("apply plan")
            : ui("continue")}
        </button>
      </div>
    );
  if (
    message.request?.executionMode === "plan" &&
    !message.planApproved &&
    remaining
  )
    return (
      <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="text-sm font-medium">
          {ui("Your plan is ready to review")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-foreground/65">
          {plan.actions.length} {ui("steps · up to")} {quotedTotal}{" "}
          {ui(
            "credits including planning. Nothing has been changed. Optional extras follow your approval preference."
          )}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onResume(undefined, true)}
          className="ai-magic mt-3 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {ui("Apply plan")}
        </button>
      </div>
    );
  if (message.status === "stopped" && remaining)
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onResume()}
        className="mt-3 rounded-lg border border-border px-3 py-2 text-xs text-primary disabled:opacity-40"
      >
        {ui("Continue remaining steps")}
      </button>
    );
  return null;
}
