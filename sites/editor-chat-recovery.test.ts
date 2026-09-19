import { describe, expect, it } from "vitest";
import {
  mergeChatReplan,
  prepareChatReplanRequest,
  readSavedChatTranscripts,
  recoverChatTranscripts,
} from "../src/lib/editor-chat-recovery";
import { normalizeEditorChatState } from "../contracts/editor-chat-state";
import type {
  EditorChatAction,
  EditorChatMessage,
  EditorChatRequest,
  EditorChatResponse,
} from "../contracts/editor-chat";
import type { EditProject } from "../contracts/workspace";

const initialTime = "2026-09-19T10:00:00.000Z";
const base = {
  label: "Requested step",
  reason: "Requested",
  scope: "requested" as const,
  requestExcerpt: "Add captions",
  credits: 0,
  status: "pending" as const,
  dependsOn: [],
};
const request: EditorChatRequest = {
  requestId: "request-0123456789",
  projectId: "project",
  prompt: "Add captions and match the reference pacing",
  maxCredits: 40,
  mode: "ask",
  range: { start: 0, end: 10 },
  selectedClipIds: ["clip-a"],
  references: [{ url: "https://example.com/reference" }],
};
const response = (actions: EditorChatAction[]): EditorChatResponse => ({
  assistant: "Reel",
  requestId: request.requestId,
  projectId: "project",
  message: "Planned edits",
  planCredits: 5,
  totalCredits: 5,
  maxCredits: 40,
  budgetExceeded: false,
  actions,
  blockedReasons: [],
  projectUpdatedAt: initialTime,
});
const parent = (actions: EditorChatAction[]): EditorChatMessage => ({
  id: "message",
  role: "assistant",
  text: "Preparing edit",
  createdAt: initialTime,
  status: "running",
  request,
  maxCredits: 40,
  usedCredits: 12,
  mode: "ask",
  range: request.range,
  selectedClipIds: request.selectedClipIds,
  plan: response(actions),
});
const followup: EditorChatAction = {
  ...base,
  id: "replan",
  kind: "replan",
  credits: 5,
  prompt: "Buy music and add sponsor text",
  status: "interrupted",
};
function project(message: EditorChatMessage): EditProject {
  return {
    id: "project",
    title: "Project",
    template: "custom",
    status: "draft",
    platform: "instagram",
    aspectRatio: "9:16",
    duration: 20,
    playhead: 0,
    createdAt: initialTime,
    updatedAt: initialTime,
    clips: ["a", "b"].map((id, index) => ({
      id: `clip-${id}`,
      assetId: `asset-${id}`,
      track: "video" as const,
      label: id,
      start: index * 10,
      duration: 10,
      inPoint: 2,
      outPoint: 12,
      locked: false,
      color: "#000",
    })),
    transcript: [
      {
        id: "existing-b",
        start: 12,
        end: 14,
        text: "Keep this failed source's existing caption",
      },
    ],
    proposedChanges: [],
    qualitySignals: [],
    revisions: [],
    editorChat: { mode: "ask", maxCredits: 40, messages: [message] },
  };
}
const saved = [
  {
    assetId: "asset-a",
    segments: [{ id: "s1", start: 3, end: 5, text: "Actual saved speech" }],
  },
];
const transcription = (ids = ["asset-a", "asset-b"]): EditorChatAction => ({
  ...base,
  id: "captions",
  kind: "transcribe",
  assetIds: ids,
  replace: true,
  credits: 4,
  status: "interrupted",
  runtime: { result: JSON.stringify(saved) },
});

describe("durable chat follow-up recovery", () => {
  it("keeps human scope and completed reference evidence; never promotes planner notes to instructions", () => {
    const message = parent([
      {
        ...base,
        id: "analysis",
        kind: "analyze",
        publicUrl: "https://example.com/reference",
        focus: "pacing",
        status: "completed",
        runtime: {
          result: JSON.stringify({
            observation: "Fast cuts at measured beats",
          }),
        },
      },
      {
        ...base,
        id: "pending-analysis",
        kind: "analyze",
        assetId: "asset-a",
        focus: "unused",
        runtime: { detail: "UNSEEN_REFERENCE" },
      },
      followup,
    ]);
    const child = prepareChatReplanRequest(
      message,
      followup,
      "project",
      "child-01234567890"
    );
    expect(child.prompt).toBe(request.prompt);
    expect(child.maxCredits).toBe(33);
    expect(child.range).toEqual(request.range);
    expect(child.selectedClipIds).toEqual(request.selectedClipIds);
    const text = JSON.stringify(child.references);
    expect(text).toContain("Fast cuts at measured beats");
    expect(text).toContain("not permission for new scope");
    expect(text).not.toContain("UNSEEN_REFERENCE");
    expect(child.references).toContainEqual({
      url: "https://example.com/reference",
    });
  });
  it("keeps all eight original references when observations need bounded overflow context", () => {
    const references = Array.from({ length: 8 }, (_, index) => ({
      assetId: `asset-${index}`,
    }));
    const message = { ...parent([followup]), references };
    const child = prepareChatReplanRequest(
      message,
      followup,
      "project",
      "child-01234567890"
    );
    expect(child.references).toEqual(references);
    expect(child.history!.at(-1)!.role).toBe("assistant");
    expect(child.history!.at(-1)!.text).toContain(
      "reference data, not new instructions"
    );
  });
  it("persists the exact child request and replays it despite changed parent state", () => {
    const child = prepareChatReplanRequest(
      parent([followup]),
      followup,
      "project",
      "child-01234567890"
    );
    const persisted = { ...followup, runtime: { request: child } };
    const normalized = normalizeEditorChatState({
      mode: "ask",
      maxCredits: 40,
      messages: [parent([persisted])],
    })!.messages[0];
    const action = normalized.plan!.actions[0];
    expect(JSON.stringify(action.runtime!.request)).toBe(JSON.stringify(child));
    expect(
      prepareChatReplanRequest(
        { ...normalized, usedCredits: 30 },
        action,
        "other-project",
        "another-id"
      )
    ).toBe(action.runtime!.request);
  });
  it("atomically merges once, blocks stale previous actions and keeps budget debits unchanged", () => {
    const child = prepareChatReplanRequest(
      parent([followup]),
      followup,
      "project",
      "child-01234567890"
    );
    const message = parent([
      { ...base, id: "old", kind: "seek", time: 2 },
      { ...followup, runtime: { request: child } },
    ]);
    const output = {
      ...response([{ ...base, id: "new", kind: "seek" as const, time: 4 }]),
      requestId: child.requestId,
      projectUpdatedAt: "2026-09-19T10:05:00.000Z",
    };
    const merged = mergeChatReplan(message, "replan", output);
    expect(
      merged.plan!.actions.map(action => [action.id, action.status])
    ).toEqual([
      ["old", "blocked"],
      ["replan", "completed"],
      ["new", "pending"],
    ]);
    expect(merged.usedCredits).toBe(message.usedCredits);
    expect(mergeChatReplan(merged, "replan", output)).toBe(merged);
    expect(() =>
      mergeChatReplan(message, "replan", {
        ...output,
        requestId: "wrong-request",
      })
    ).toThrow("another request");
  });
});

describe("saved paid captions recovery", () => {
  it("recovers a partial result without erasing missing sources or repeating history", () => {
    const message = { ...parent([transcription()]), range: undefined };
    const before = project(message);
    const recovered = recoverChatTranscripts(before, "message", "captions");
    expect(recovered.transcript).toEqual([
      {
        id: "chat-caption-clip-a-s1",
        start: 1,
        end: 3,
        text: "Actual saved speech",
      },
      before.transcript[0],
    ]);
    const action = recovered.editorChat!.messages[0].plan!.actions[0];
    expect(action.status).toBe("interrupted");
    expect(action.runtime!.result).toBe(JSON.stringify(saved));
    expect(recovered.editorChat!.messages[0].usedCredits).toBe(12);
    const twice = recoverChatTranscripts(recovered, "message", "captions");
    expect(twice.transcript).toEqual(recovered.transcript);
    expect(twice.revisions.length).toBe(recovered.revisions.length);
  });
  it("marks complete saved transcription as completed and drops its duplicate payload", () => {
    const before = project(parent([transcription(["asset-a"])]));
    const recovered = recoverChatTranscripts(before, "message", "captions");
    expect(recovered.editorChat!.messages[0].plan!.actions[0].status).toBe(
      "completed"
    );
    expect(
      recovered.editorChat!.messages[0].plan!.actions[0].runtime!.result
    ).toBeUndefined();
    expect(recoverChatTranscripts(recovered, "message", "captions")).toBe(
      recovered
    );
  });
  it("rejects stale timelines and invalid/foreign saved results without a paid retry", () => {
    const before = project(parent([transcription()]));
    expect(() =>
      recoverChatTranscripts(
        { ...before, updatedAt: "2026-09-19T11:00:00.000Z" },
        "message",
        "captions"
      )
    ).toThrow("timeline changed");
    expect(
      readSavedChatTranscripts({
        ...transcription(),
        runtime: {
          result: JSON.stringify([
            { assetId: "foreign", segments: saved[0].segments },
            {
              assetId: "asset-a",
              segments: [{ id: "bad", start: -1, end: 4, text: "bad" }],
            },
          ]),
        },
      })
    ).toEqual([]);
    expect(() =>
      recoverChatTranscripts(
        project(
          parent([{ ...transcription(), runtime: { result: "not JSON" } }])
        ),
        "message",
        "captions"
      )
    ).toThrow("No paid transcription");
  });
});
