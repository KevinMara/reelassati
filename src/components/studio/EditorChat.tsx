import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  ArrowUp,
  ClipboardList,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  CircleAlert,
  Clock3,
  Film,
  Image,
  Link2,
  Loader2,
  MessageCircle,
  Music2,
  Paperclip,
  Plus,
  Scissors,
  Settings2,
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
import { useWorkspace } from "@/providers/workspace";
import { cn } from "@/lib/utils";
import { CompactSelect } from "@/components/ui/compact-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TimeRange = { start: number; end: number };
type Props = {
  project: EditProject;
  playhead: number;
  selectedClipId?: string | null;
  seed?: { text: string; id: number; range?: TimeRange };
  onSeek: (time: number) => void;
  onAutoEdit: () => void;
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
function actionStateLabel(action: EditorChatAction) {
  const labels = {
    pending: "Queued",
    "awaiting-approval": "Your choice",
    running: "Working",
    completed: "Done",
    skipped: "Skipped",
    failed: "Needs attention",
    blocked: "Paused",
    interrupted: "Interrupted",
  };
  if (
    action.status === "interrupted" &&
    action.kind === "generate" &&
    action.runtime?.jobId
  )
    return "Generating";
  return labels[action.status];
}

export function EditorChat({
  project,
  playhead,
  selectedClipId,
  seed,
  onSeek,
  onAutoEdit,
}: Props) {
  const chat = useEditorChat(project, { onSeek });
  const { workspace } = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [taskPreset, setTaskPreset] = useState<EditorTaskPresetId>();
  const [executionMode, setExecutionMode] = useState<"plan" | "execute">(
    "execute"
  );
  const [excludedClip, setExcludedClip] = useState<string>();
  const contextClip =
    selectedClipId !== excludedClip
      ? project.clips.find(c => c.id === selectedClipId)
      : undefined;
  const [references, setReferences] = useState<EditorChatReference[]>([]);
  const [range, setRange] = useState<TimeRange>();
  const [attachBusy, setAttachBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(chat.state.maxCredits));
  const [workingChoice, setWorkingChoice] = useState<string>();
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const lastSeed = useRef<number | undefined>(undefined);
  const dragDepth = useRef(0);
  const previousProjectId = useRef(project.id);

  useEffect(() => {
    if (previousProjectId.current === project.id) return;
    previousProjectId.current = project.id;
    setPrompt("");
    setTaskPreset(undefined);
    setExcludedClip(undefined);
    setReferences([]);
    setRange(undefined);
    setLocalError("");
    lastSeed.current = undefined;
  }, [project.id]);
  useEffect(() => {
    if (!seed || seed.id === lastSeed.current) return;
    lastSeed.current = seed.id;
    setPrompt(seed.text);
    setRange(seed.range);
    input.current?.focus();
  }, [seed]);
  useEffect(() => {
    setBudgetInput(String(chat.state.maxCredits));
  }, [chat.state.maxCredits]);
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
        "Let the current files finish uploading before adding more."
      );
      return;
    }
    if (references.length + files.length > 8) {
      setLocalError(
        "Attach up to 8 references per message. Remove one to make room."
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
      setLocalError("Enter a complete public https:// reference link.");
    }
  }
  async function runChoice(id: string, callback: () => Promise<void>) {
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
    if (!text || chat.busy || attachBusy || workingChoice) return;
    if (references.length > 8) {
      setLocalError(
        "Attach up to 8 references per message. Remove one to make room."
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
        "Shorten text references to 16,000 characters each and 40,000 total before sending."
      );
      return;
    }
    setLocalError("");
    followLatest.current = true;
    const sentRefs = references;
    const sentRange = range;
    const sentPreset = taskPreset;
    setPrompt("");
    setReferences([]);
    setRange(undefined);
    setTaskPreset(undefined);
    try {
      await chat.send(
        text,
        sentRefs,
        sentRange,
        contextClip ? [contextClip.id] : undefined,
        { taskPreset: sentPreset, executionMode }
      );
    } catch (error) {
      setPrompt(current => current || text);
      addReferences(sentRefs);
      setRange(sentRange);
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
  const busyChoice = chat.busy || !!workingChoice;
  const error = localError || chat.error;

  return (
    <section
      aria-label={`${EDITOR_ASSISTANT_NAME} editing chat`}
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface"
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
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{EDITOR_ASSISTANT_NAME}</h2>
          <p className="text-[11px] text-foreground/50">Your editing partner</p>
        </div>
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Chat preferences"
              title="Chat preferences"
              className="rounded-lg p-2 text-foreground/55 hover:bg-foreground/5 hover:text-foreground"
            >
              <Settings2 className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-72 rounded-xl border-border bg-surface text-foreground"
          >
            <h3 className="mb-3 text-sm font-semibold">How Reel works</h3>
            <label className="mb-1.5 block text-xs text-foreground/60">
              Optional improvements
            </label>
            <CompactSelect
              aria-label="Approval mode"
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
              Requested edits and their necessary steps run directly.{" "}
              {chat.state.mode === "ask"
                ? "You choose whether to include additional suggestions."
                : "Reel can include extra improvements within your credit limit."}
            </p>
            <label
              className="mb-1.5 mt-4 block text-xs text-foreground/60"
              htmlFor="reel-credit-limit"
            >
              Credit limit per request
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
                Save
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-foreground/45">
              Includes the 5-credit planning step and any paid actions. Approval
              mode never raises this limit.
            </p>
          </PopoverContent>
        </Popover>
      </header>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={onAutoEdit}
          className="ai-magic flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
        >
          <Sparkles className="size-4" /> AI auto-edit
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
            "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
            executionMode === "plan"
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border text-foreground/70 hover:bg-foreground/5"
          )}
        >
          <ClipboardList className="size-4" /> Plan
        </button>
      </div>

      <div
        ref={scroller}
        onScroll={() => {
          const node = scroller.current;
          if (node)
            followLatest.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 90;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        aria-label="Conversation"
      >
        {project.proposedChanges.some(
          change => change.status === "proposed"
        ) && (
          <details className="mb-4 rounded-xl border border-border bg-background/35 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Saved suggestions ·{" "}
              {
                project.proposedChanges.filter(
                  change => change.status === "proposed"
                ).length
              }
            </summary>
            <p className="mt-2 text-xs text-foreground/60">
              Earlier analysis suggestions are still available to review.
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
                      Apply change
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
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </details>
        )}
        {!chat.state.messages.length ? (
          <div className="flex min-h-full flex-col justify-center px-1 py-5">
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageCircle className="size-5" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">
              What are we making?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground/55">
              Tell Reel what you want to change. Attach a reference, point to a
              moment, or start with an idea.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {STARTERS.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => starter(item.preset)}
                  className="flex min-h-16 flex-col items-start gap-2 rounded-xl border border-border bg-background/40 p-3 text-left text-xs text-foreground/75 transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <item.icon className="size-4 text-primary" />
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-foreground/40">
              Changes appear on your timeline as they finish. You can keep
              editing them by hand.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {chat.state.messages.map(message => (
              <div
                key={message.id}
                className={cn("min-w-0", message.role === "user" && "ml-5")}
              >
                {message.role === "user" ? (
                  <div className="rounded-2xl rounded-tr-sm bg-primary/12 px-3 py-2.5">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.text}
                    </p>
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
                        {editorTaskPreset(message.request.taskPreset)?.label}
                        {message.request.executionMode === "plan"
                          ? " · Plan first"
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
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">
                        {message.text}
                      </p>
                    )}
                    {message.status === "planning" && (
                      <div
                        role="status"
                        className="ai-status-text mt-3 flex items-center gap-2 text-xs"
                      >
                        <Loader2 className="size-3.5 animate-spin" />
                        Reading your request and project…
                      </div>
                    )}
                    {!!message.plan?.actions.length && (
                      <div className="mt-3 space-y-2">
                        {message.plan.actions.map(action => (
                          <ActionCard
                            key={action.id}
                            action={action}
                            busy={busyChoice}
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
                            ? "Partly completed · review the steps above"
                            : "Needs attention · review the steps above"}
                        </p>
                      )}
                    {message.status === "completed" &&
                      message.plan &&
                      editorChatRunStatus(
                        message.plan.actions,
                        message.plan.blockedReasons
                      ) === "completed" && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-foreground/45">
                          <CheckCheck className="size-3" />
                          {message.plan.actions.length
                            ? "Finished"
                            : "No changes made"}
                          {typeof message.usedCredits === "number"
                            ? ` · up to ${message.usedCredits} credits`
                            : ""}
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-3">
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
          className="rounded-xl border border-border bg-background/65 p-2.5 focus-within:border-primary/55 focus-within:ring-1 focus-within:ring-primary/15"
        >
          {(range || contextClip || taskPreset || executionMode === "plan") && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-primary">
              {range && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 py-1 pl-1.5 pr-1">
                  <Clock3 className="size-3" />
                  {seconds(range.start)}–{seconds(range.end)}
                  <button
                    type="button"
                    aria-label="Remove time range"
                    onClick={() => setRange(undefined)}
                    className="rounded p-0.5 hover:bg-primary/10"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {executionMode === "plan" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs">
                  <ClipboardList className="size-3" /> Plan first
                  <button
                    type="button"
                    aria-label="Exit planning mode"
                    onClick={() => setExecutionMode("execute")}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {taskPreset && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs">
                  <WandSparkles className="size-3" />
                  {editorTaskPreset(taskPreset)?.label}
                  <button
                    type="button"
                    aria-label="Remove task preset"
                    onClick={() => setTaskPreset(undefined)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {contextClip && (
                <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs">
                  <span className="truncate" title={contextClip.label}>
                    Target: {contextClip.graphic?.text || contextClip.label}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove clip from chat context"
                    onClick={() => setExcludedClip(contextClip.id)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
          )}
          {!!references.length && (
            <div className="mb-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {references.map((ref, index) => (
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
                    aria-label={`Remove ${refLabel(ref)}`}
                    onClick={() =>
                      setReferences(current =>
                        current.filter((_, i) => i !== index)
                      )
                    }
                    className="rounded p-0.5 hover:bg-foreground/10"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={input}
            aria-label="Message Reel"
            placeholder={
              taskPreset
                ? editorTaskPreset(taskPreset)?.hint
                : executionMode === "plan"
                  ? "Describe the result. Reel will make a plan for you to review…"
                  : "Ask Reel to edit your video…"
            }
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={3}
            onKeyDown={event => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
            className="max-h-40 min-h-16 w-full resize-none border-0 bg-transparent text-sm leading-relaxed outline-none placeholder:text-foreground/35"
          />
          <div className="mt-1 flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Attach or choose an editing task"
                  disabled={attachBusy}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-foreground/60 hover:bg-foreground/5 disabled:opacity-40"
                >
                  {attachBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="w-60 rounded-xl border-border bg-surface p-1.5 text-foreground"
              >
                <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                  <Paperclip />
                  Attach reference files
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setUrlOpen(true)}>
                  <Link2 />
                  Attach a reference link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-normal text-foreground/45">
                  Start with a task
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => {
                    setExecutionMode("plan");
                    input.current?.focus();
                  }}
                >
                  <ClipboardList /> Plan before editing
                </DropdownMenuItem>
                {EDITOR_TASK_PRESETS.filter(
                  preset => preset.id !== "range"
                ).map(preset => (
                  <DropdownMenuItem
                    key={preset.id}
                    onSelect={() => starter(preset.id)}
                  >
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
                    {preset.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  disabled={project.duration <= 0}
                  onSelect={() => {
                    const start = Math.max(
                      0,
                      Math.min(playhead, project.duration - 0.1)
                    );
                    setTaskPreset("range");
                    setRange({
                      start,
                      end: Math.min(project.duration, start + 5),
                    });
                    input.current?.focus();
                  }}
                >
                  <Clock3 />
                  Edit around the playhead
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onAutoEdit}>
                  <Sparkles />
                  Advanced AI auto-edit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover open={urlOpen} onOpenChange={setUrlOpen}>
              <PopoverTrigger asChild>
                <span className="w-0" aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-72 rounded-xl border-border bg-surface text-foreground"
              >
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="reel-reference-url"
                >
                  Reference link
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
                  Use a public link. Upload the file if the source requires
                  sign-in.
                </p>
                <button
                  type="button"
                  onClick={addLink}
                  className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  Attach link
                </button>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] text-foreground/50 hover:text-foreground"
              title={`Optional improvements: ${chat.state.mode === "ask" ? "ask first" : "automatically approved"}. Limit: ${chat.state.maxCredits} credits.`}
            >
              <span className="truncate">
                {chat.state.mode === "ask"
                  ? "Ask before extras"
                  : "Auto extras"}
              </span>
              <ChevronDown className="size-3 shrink-0" />
            </button>
            <span className="ml-auto whitespace-nowrap text-[10px] text-foreground/35">
              ≤ {chat.state.maxCredits} cr
            </span>
            {chat.busy ? (
              <button
                type="button"
                onClick={chat.stop}
                aria-label="Stop after current action"
                title="Stop after current action"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!prompt.trim() || attachBusy || !!workingChoice}
                aria-label="Send to Reel, 5 credits for planning"
                title="Send · 5 credits for planning"
                className="ai-magic flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </form>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-foreground/40">
          <span>Planning: 5 credits · manual edits: free</span>
          <span title="Shift + Enter for a new line">↵ Send</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT_FILES}
          className="hidden"
          aria-label="Attach reference files"
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
            <p className="text-sm font-medium">Drop a reference for Reel</p>
            <p className="mt-1 text-xs text-foreground/50">
              Files stay attached to your message.
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
}: {
  action: EditorChatAction;
  busy: boolean;
  working: boolean;
  onApprove: () => void;
  onSkip: () => void;
  onRecover: () => void;
}) {
  const needsChoice = action.status === "awaiting-approval";
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
            <span>{actionStateLabel(action)}</span>
            <span>
              {action.credits ? `${action.credits} credits` : "No AI credits"}
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
              disabled={busy}
              onClick={onApprove}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              Include it{action.credits ? ` · ${action.credits} cr` : ""}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSkip}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-foreground/5 disabled:opacity-40"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        action.reason && (
          <details className="mt-2 text-[11px] text-foreground/45">
            <summary className="cursor-pointer select-none">
              Why this step
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
            ? "Retry free sound"
            : `Check ${action.kind === "generate" ? (action.media === "speech" ? "voiceover" : action.media === "sfx" ? "sound effect" : action.media) : action.kind === "transcribe" ? "saved captions" : "saved plan"}`}
        </button>
      )}
      {action.status === "interrupted" && (
        <p className="mt-2 text-[10px] leading-relaxed text-foreground/45">
          Interrupted work is not automatically submitted again.
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
  const plan = message.plan;
  if (!plan)
    return message.request && message.status !== "planning" ? (
      <button
        type="button"
        disabled={busy}
        onClick={() => onResume()}
        className="mt-3 rounded-lg border border-border px-3 py-2 text-sm text-primary disabled:opacity-40"
      >
        Recover saved plan
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
        <p className="text-xs font-medium">This plan needs a higher limit</p>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground/60">
          Up to {quotedTotal} credits including planning. Your current limit is{" "}
          {budget}. Raising it does not approve optional extras.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onResume(quotedTotal, message.request?.executionMode === "plan")
          }
          className="mt-2 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          Set limit to {quotedTotal} &{" "}
          {message.request?.executionMode === "plan" && !message.planApproved
            ? "apply plan"
            : "continue"}
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
        <p className="text-sm font-medium">Your plan is ready to review</p>
        <p className="mt-1 text-xs leading-relaxed text-foreground/65">
          {plan.actions.length} steps · up to {quotedTotal} credits including
          planning. Nothing has been changed. Optional extras follow your
          approval preference.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onResume(undefined, true)}
          className="ai-magic mt-3 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Apply plan
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
        Continue remaining steps
      </button>
    );
  return null;
}
