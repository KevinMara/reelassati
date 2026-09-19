import type { EditProject } from "@contracts/workspace";
import type {
  EditorChatAction,
  EditorChatMessage,
} from "@contracts/editor-chat";

/** Use inside the workspace updater, after any network call has returned. */
export function applyChatCompletion(
  current: EditProject,
  messageId: string,
  actionId: string,
  options: {
    detail: string;
    timelineMutation: boolean;
    transform?: (project: EditProject) => EditProject;
  }
): EditProject {
  const chat = current.editorChat;
  const message = chat?.messages.find(item => item.id === messageId);
  const action = message?.plan?.actions.find(item => item.id === actionId);
  if (!chat || !message?.plan || !action)
    throw new Error("The saved chat action no longer exists.");
  // A stale UI or duplicate recovery result must not run a completed edit again.
  if (action.status === "completed" || action.status === "skipped")
    return current;
  if (
    options.timelineMutation &&
    (message.plan.projectId !== current.id ||
      message.plan.projectUpdatedAt !== current.updatedAt)
  ) {
    return patchAction(current, messageId, actionId, {
      ...action,
      status: "blocked",
      error:
        "The timeline changed while this action was running. The current edit was kept.",
      runtime: {
        ...action.runtime,
        detail:
          "Any generated file remains in Library. Send a fresh instruction for the current timeline.",
      },
    });
  }
  const next = options.transform ? options.transform(current) : current;
  return {
    ...next,
    editorChat: {
      ...chat,
      messages: chat.messages.map(item =>
        item.id !== messageId || !item.plan
          ? item
          : {
              ...item,
              plan: {
                ...item.plan,
                // Read-only results must not adopt a concurrent manual edit as their plan baseline.
                projectUpdatedAt: options.timelineMutation
                  ? next.updatedAt
                  : item.plan.projectUpdatedAt,
                actions: item.plan.actions.map(step =>
                  step.id !== actionId
                    ? step
                    : {
                        ...step,
                        status: "completed",
                        error: undefined,
                        runtime: { ...step.runtime, detail: options.detail },
                      }
                ),
              },
            }
      ),
    },
  };
}

function patchAction(
  project: EditProject,
  messageId: string,
  actionId: string,
  replacement: EditorChatAction
): EditProject {
  return {
    ...project,
    editorChat: {
      ...project.editorChat!,
      messages: project.editorChat!.messages.map(message =>
        message.id !== messageId || !message.plan
          ? message
          : {
              ...message,
              plan: {
                ...message.plan,
                actions: message.plan.actions.map(action =>
                  action.id === actionId ? replacement : action
                ),
              },
            }
      ),
    },
  };
}

/** Scope UI can only transition a not-yet-started action, even after a double click. */
export function changeChatScopeDecision(
  action: EditorChatAction,
  decision: "approve" | "skip"
): EditorChatAction {
  if (!(["pending", "awaiting-approval"] as string[]).includes(action.status))
    return action;
  if (
    action.runtime?.startedAt ||
    action.runtime?.generationId ||
    action.runtime?.jobId ||
    action.runtime?.assetId
  )
    return action;
  if (decision === "approve") {
    if (action.scope !== "extra") return action;
    return {
      ...action,
      status: "pending",
      runtime: { ...action.runtime, approved: true },
    };
  }
  return { ...action, status: "skipped" };
}

/** Clamp a mapped source transcript without replacing captions outside the requested range. */
export function mergeChatTranscript(
  project: EditProject,
  incoming: EditProject["transcript"],
  replace: boolean,
  range?: EditorChatMessage["range"]
): EditProject["transcript"] {
  const start = range?.start ?? 0;
  const end = range?.end ?? project.duration;
  const mapped = incoming
    .map(segment => ({
      ...segment,
      start: Math.max(start, segment.start),
      end: Math.min(end, segment.end),
    }))
    .filter(segment => segment.end > segment.start);
  const ids = new Set(mapped.map(segment => segment.id));
  const kept = project.transcript.flatMap(segment => {
    if (!replace && !ids.has(segment.id)) return [segment];
    if (!range) return [];
    if (segment.end <= start || segment.start >= end) return [segment];
    // Preserve both outside portions if one existing segment crosses the selected range.
    return [
      ...(segment.start < start
        ? [{ ...segment, id: `${segment.id}-before-${start}`, end: start }]
        : []),
      ...(segment.end > end
        ? [{ ...segment, id: `${segment.id}-after-${end}`, start: end }]
        : []),
    ];
  });
  return [...kept, ...mapped].sort(
    (left, right) => left.start - right.start || left.end - right.end
  );
}
