import {
  catalogAudioPlacement,
  findCatalogAudio,
} from "./editor-catalog-audio";
import type {
  EditorChatAction,
  EditorChatMessage,
  EditorChatState,
  EditorChatRequest,
  EditorChatResponse,
  EditorChatReference,
} from "./editor-chat";

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const string = (value: unknown, limit = 160) =>
  typeof value === "string" ? value.slice(0, limit) : "";
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const range = (value: unknown) => {
  const row = record(value);
  return row &&
    finite(row.start) &&
    finite(row.end) &&
    row.start >= 0 &&
    row.end > row.start &&
    row.end <= 86400
    ? { start: row.start, end: row.end }
    : undefined;
};
const ids = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter(
          (id): id is string => typeof id === "string" && id.length <= 160
        )
        .slice(0, 80)
    : [];
const actionStatuses = new Set([
  "pending",
  "awaiting-approval",
  "running",
  "completed",
  "skipped",
  "failed",
  "blocked",
  "interrupted",
]);

/** Bounded JSON copying avoids retaining arbitrary objects or unsafe property prototypes. */
function bounded(value: unknown, key = "", depth = 0): unknown {
  if (depth > 12) return undefined;
  if (typeof value === "string")
    return value.slice(
      0,
      key === "text" ? 16000 : key === "detail" ? 8000 : 6000
    );
  if (typeof value === "boolean" || value === null) return value;
  if (finite(value)) return value;
  if (Array.isArray(value))
    return value.slice(0, 200).map(item => bounded(item, key, depth + 1));
  const row = record(value);
  if (!row) return undefined;
  return Object.fromEntries(
    Object.entries(row)
      .slice(0, 80)
      .filter(
        ([name]) =>
          !["__proto__", "constructor", "prototype", "result"].includes(name)
      )
      .map(([name, item]) => [name, bounded(item, name, depth + 1)])
  );
}

function actionValue(
  raw: unknown,
  selectedRange?: { start: number; end: number }
): EditorChatAction | undefined {
  const value = record(bounded(raw));
  const original = record(raw);
  if (
    !value ||
    !original ||
    !string(value.id) ||
    !string(value.label) ||
    !actionStatuses.has(String(value.status)) ||
    !["requested", "necessary", "extra"].includes(String(value.scope)) ||
    !finite(value.credits) ||
    !Number.isSafeInteger(value.credits) ||
    value.credits < 0 ||
    value.credits > 100000
  )
    return undefined;
  const kind = value.kind;
  if (kind === "edit") {
    const op = record(value.operation);
    if (
      !op ||
      !string(op.id) ||
      ![
        "trim",
        "split",
        "move",
        "delete",
        "caption",
        "silence",
        "pacing",
        "broll",
        "audio",
        "style",
        "graphic",
      ].includes(String(op.type)) ||
      !finite(op.start) ||
      !finite(op.end) ||
      op.start < 0 ||
      op.end < op.start ||
      op.end > 86400 ||
      !Array.isArray(op.targetClipIds)
    )
      return undefined;
  } else if (kind === "transcribe") {
    if (!ids(value.assetIds).length) return undefined;
    value.assetIds = ids(value.assetIds);
    value.replace = value.replace === true;
  } else if (kind === "analyze") {
    if (
      !string(value.assetId) &&
      !(
        typeof value.publicUrl === "string" &&
        value.publicUrl.length <= 2000 &&
        /^https:\/\//.test(value.publicUrl)
      )
    )
      return undefined;
  } else if (kind === "catalog-audio") {
    try {
      const entry = findCatalogAudio(value.catalogId);
      value.catalogId = entry.id;
      value.credits = 0;
      if (original.insert !== undefined) {
        const insert = record(value.insert);
        if (!insert || !finite(insert.duration) || insert.duration <= 0)
          return undefined;
        value.insert = catalogAudioPlacement(
          entry,
          insert,
          86400,
          selectedRange
        );
      }
    } catch {
      return undefined;
    }
  } else if (kind === "generate") {
    if (
      !["image", "video", "speech", "music", "sfx"].includes(
        String(value.media)
      ) ||
      !string(value.prompt, 6000)
    )
      return undefined;
    const insert = record(value.insert);
    if (
      insert &&
      (!finite(insert.start) ||
        insert.start < 0 ||
        (insert.duration !== undefined &&
          (!finite(insert.duration) || insert.duration <= 0)))
    )
      return undefined;
  } else if (kind === "insert") {
    if (
      !string(value.assetId) ||
      !finite(value.start) ||
      value.start < 0 ||
      value.start > 86400
    )
      return undefined;
  } else if (kind === "settings") {
    if (
      value.aspectRatio !== undefined &&
      !["9:16", "16:9", "1:1"].includes(String(value.aspectRatio))
    )
      return undefined;
    if (
      value.duration !== undefined &&
      (!finite(value.duration) ||
        value.duration < 0.2 ||
        value.duration > 86400)
    )
      return undefined;
  } else if (kind === "history") {
    if (value.direction !== "undo" && value.direction !== "redo")
      return undefined;
  } else if (kind === "seek") {
    if (!finite(value.time) || value.time < 0 || value.time > 86400)
      return undefined;
  } else if (kind === "replan") {
    if (!string(value.prompt, 6000)) return undefined;
  } else if (kind === "story-beats") {
    if (!Array.isArray(value.beats)) return undefined;
    value.beats = value.beats
      .filter(rawBeat => {
        const beat = record(rawBeat);
        return (
          beat &&
          string(beat.id) &&
          finite(beat.start) &&
          finite(beat.end) &&
          beat.start >= 0 &&
          beat.end > beat.start &&
          beat.end <= 86400 &&
          ids(beat.evidenceIds).length
        );
      })
      .slice(0, 40);
  } else return undefined;
  value.id = string(value.id);
  value.label = string(value.label, 160);
  value.reason = string(value.reason, 1000);
  value.requestExcerpt = string(value.requestExcerpt, 1000);
  value.dependsOn = ids(value.dependsOn).slice(0, 24);
  const runtime = record(value.runtime) || {};
  for (const field of [
    "generationId",
    "jobId",
    "assetId",
    "startedAt",
  ] as const)
    if (runtime[field] !== undefined) runtime[field] = string(runtime[field]);
  const rawRuntime = record(original.runtime);
  if (typeof rawRuntime?.result === "string") {
    // Paid partial transcripts are opaque recovery payloads: preserve exactly or omit, never truncate JSON.
    if (new TextEncoder().encode(rawRuntime.result).byteLength <= 131072) {
      try {
        JSON.parse(rawRuntime.result);
        runtime.result = rawRuntime.result;
      } catch {
        /* invalid recovery payload */
      }
    }
    if (
      !runtime.result &&
      value.kind === "transcribe" &&
      value.status !== "completed"
    ) {
      value.status = "interrupted";
      runtime.detail =
        "The saved recovery payload is unavailable. Check the transcript before starting another paid transcription.";
    }
  }
  if (Object.keys(runtime).length) value.runtime = runtime;
  return value as unknown as EditorChatAction;
}

function references(raw: unknown): EditorChatReference[] {
  let remaining = 40000;
  return (Array.isArray(raw) ? raw : [])
    .slice(0, 8)
    .flatMap<EditorChatReference>(item => {
      const row = record(item);
      if (!row) return [];
      if (string(row.assetId)) return [{ assetId: string(row.assetId) }];
      if (typeof row.text === "string" && string(row.name)) {
        const text = row.text.slice(0, Math.min(16000, remaining));
        remaining -= text.length;
        return [{ name: string(row.name), text }];
      }
      if (
        typeof row.url === "string" &&
        row.url.length <= 2000 &&
        /^https:\/\//.test(row.url)
      )
        return [{ url: row.url }];
      return [];
    });
}

/** Workspace projection limits; this does not confer execution, asset ownership or billing authority. */
export function normalizeEditorChatState(
  raw: unknown
): EditorChatState | undefined {
  const value = record(raw);
  if (!value) return undefined;
  const messages: EditorChatMessage[] = [];
  for (const candidate of Array.isArray(value.messages)
    ? value.messages.slice(-60)
    : []) {
    const row = record(candidate);
    if (
      !row ||
      !string(row.id) ||
      (row.role !== "user" && row.role !== "assistant") ||
      typeof row.createdAt !== "string" ||
      !Number.isFinite(Date.parse(row.createdAt))
    )
      continue;
    const message: EditorChatMessage = {
      id: string(row.id),
      role: row.role,
      text: string(row.text, 6000),
      createdAt: row.createdAt,
      ...(row.planApproved === true ? { planApproved: true } : {}),
      ...(string(row.requestId) ? { requestId: string(row.requestId) } : {}),
      ...(Array.isArray(row.references)
        ? { references: references(row.references) }
        : {}),
      ...(row.mode === "ask" || row.mode === "auto" ? { mode: row.mode } : {}),
      ...(finite(row.maxCredits)
        ? {
            maxCredits: Math.max(
              5,
              Math.min(100000, Math.floor(row.maxCredits))
            ),
          }
        : {}),
      ...(finite(row.usedCredits)
        ? {
            usedCredits: Math.max(
              0,
              Math.min(100000, Math.ceil(row.usedCredits))
            ),
          }
        : {}),
      ...(range(row.range) ? { range: range(row.range) } : {}),
      ...(Array.isArray(row.selectedClipIds)
        ? { selectedClipIds: ids(row.selectedClipIds).slice(0, 20) }
        : {}),
    };
    if (
      [
        "planning",
        "ready",
        "running",
        "completed",
        "failed",
        "stopped",
      ].includes(String(row.status))
    )
      message.status = row.status as EditorChatMessage["status"];
    const plan = record(bounded(row.plan));
    const originalPlan = record(row.plan);
    if (
      plan &&
      originalPlan &&
      Array.isArray(originalPlan.actions) &&
      string(plan.requestId) &&
      string(plan.projectId)
    ) {
      plan.actions = originalPlan.actions
        .slice(0, 80)
        .map(action => actionValue(action, message.range))
        .filter(Boolean);
      plan.assistant = "Reel";
      plan.message = string(plan.message, 3000);
      plan.blockedReasons = Array.isArray(plan.blockedReasons)
        ? plan.blockedReasons
            .filter(reason => typeof reason === "string")
            .slice(0, 24)
        : [];
      message.plan = plan as unknown as EditorChatResponse;
    }
    const request = record(bounded(row.request));
    if (
      request &&
      /^[a-zA-Z0-9-]{16,80}$/.test(string(request.requestId)) &&
      string(request.projectId) &&
      string(request.prompt, 6000)
    ) {
      request.references = references(request.references);
      message.request = request as unknown as EditorChatRequest;
    }
    messages.push(message);
  }
  const measure = () =>
    new TextEncoder().encode(JSON.stringify(messages)).byteLength;
  while (messages.length > 1 && measure() > 400000) {
    const terminal = messages.findIndex(
      message =>
        !["planning", "running", "ready"].includes(message.status || "")
    );
    messages.splice(terminal >= 0 ? terminal : 0, 1);
  }
  return {
    mode: value.mode === "auto" ? "auto" : "ask",
    preferencesVersion: 2,
    maxCredits:
      value.maxCredits === 100 && value.preferencesVersion !== 2
        ? 200
        : finite(value.maxCredits)
          ? Math.max(5, Math.min(100000, Math.floor(value.maxCredits)))
          : 200,
    messages,
  };
}
