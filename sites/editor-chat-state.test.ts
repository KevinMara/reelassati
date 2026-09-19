import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { normalizeEditorChatState } from "../contracts/editor-chat-state";
import { parseEditorChatRequest } from "./editor-chat";

const action = {
  id: "action-paid",
  kind: "transcribe",
  label: "Captions",
  reason: "Requested",
  scope: "requested",
  requestExcerpt: "Add captions",
  credits: 2,
  status: "interrupted",
  dependsOn: [],
  assetIds: ["source"],
  replace: true,
};
const message = {
  id: "message",
  role: "assistant",
  text: "Adding captions",
  createdAt: "2026-09-19T10:00:00.000Z",
  status: "stopped",
  plan: {
    assistant: "Reel",
    requestId: "request-0123456789",
    projectId: "project",
    message: "Adding captions",
    actions: [action],
    totalCredits: 7,
    planCredits: 5,
    maxCredits: 100,
    budgetExceeded: false,
    blockedReasons: [],
    projectUpdatedAt: "2026-09-19",
  },
};

describe("saved editing chat continuity", () => {
  it("preserves paid result JSON and recovery identifiers exactly", () => {
    const result = JSON.stringify([
      {
        assetId: "source",
        segments: [
          { id: "segment", start: 0, end: 2, text: "Complete source words" },
        ],
        provenance: { recordId: "record-id" },
      },
    ]);
    const state = normalizeEditorChatState({
      mode: "ask",
      maxCredits: 100,
      messages: [
        {
          ...message,
          plan: {
            ...message.plan,
            actions: [
              {
                ...action,
                runtime: {
                  result,
                  generationId: "generation-uuid",
                  jobId: "provider-job",
                  assetId: "real-asset",
                  approved: true,
                },
              },
            ],
          },
        },
      ],
    })!;
    expect(state.messages[0].plan!.actions[0].runtime).toEqual({
      result,
      generationId: "generation-uuid",
      jobId: "provider-job",
      assetId: "real-asset",
      approved: true,
    });
  });
  it("never saves truncated JSON as a recoverable paid result", () => {
    const state = normalizeEditorChatState({
      messages: [
        {
          ...message,
          plan: {
            ...message.plan,
            actions: [
              {
                ...action,
                status: "running",
                runtime: {
                  result: JSON.stringify({ text: "x".repeat(132000) }),
                },
              },
            ],
          },
        },
      ],
    })!;
    expect(state.messages[0].plan!.actions[0].runtime?.result).toBeUndefined();
    expect(state.messages[0].plan!.actions[0].status).toBe("interrupted");
  });
  it("preserves normalized request bytes for no-charge same-id plan recovery", () => {
    const request = parseEditorChatRequest({
      requestId: "request-0123456789",
      projectId: "project",
      prompt: "Add captions",
      maxCredits: 100,
      mode: "ask",
      references: [{ name: "brief.md", text: "q".repeat(16000) }],
      history: [{ role: "user", text: "Existing context" }],
      selectedClipIds: ["clip"],
    });
    const state = normalizeEditorChatState({
      messages: [{ ...message, request }],
    })!;
    expect(
      JSON.stringify(parseEditorChatRequest(state.messages[0].request))
    ).toBe(JSON.stringify(request));
  });
  it("preserves the normalized child-request fingerprint across JSON save/load at every request bound", () => {
    const sourceEvidence = JSON.stringify({
      result: {
        captions: "Measured source evidence",
        cutTimes: [1.25, 4.75],
        note: "Quoted result keys inside reference text remain data",
      },
    });
    const request = parseEditorChatRequest({
      requestId: "followup-request-0123456789",
      projectId: "project",
      mode: "auto",
      maxCredits: 100000,
      prompt: "scene ".repeat(1000).trim(),
      range: { start: 1.125, end: 12345.875 },
      selectedClipIds: Array.from(
        { length: 20 },
        (_, index) => `clip-${index}`
      ),
      references: [
        { name: "full-brief.txt", text: "b".repeat(16000) },
        {
          name: "source-observations.txt",
          text: sourceEvidence + "e".repeat(16000 - sourceEvidence.length),
        },
        { name: "notes.txt", text: "n".repeat(8000) },
        { url: "https://example.com/" + "u".repeat(1980) },
        ...Array.from({ length: 4 }, (_, index) => ({
          assetId: `reference-${index}`,
        })),
      ],
      history: Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 ? "assistant" : "user",
        text: `${index}:` + "h".repeat(1997),
      })),
    });
    const fingerprint = (value: unknown) =>
      createHash("sha256")
        .update(JSON.stringify(parseEditorChatRequest(value)))
        .digest("hex");
    const original = {
      ...message,
      plan: {
        ...message.plan,
        actions: [
          {
            ...action,
            id: "followup",
            kind: "replan",
            prompt: "Use the measured evidence",
            credits: 5,
            runtime: {
              request,
              result: sourceEvidence,
              generationId: "paid-generation-id",
              startedAt: "2026-09-19T10:00:00.000Z",
            },
          },
        ],
      },
    };
    const stored = normalizeEditorChatState(
      JSON.parse(
        JSON.stringify({
          mode: "auto",
          maxCredits: 100000,
          messages: [original],
        })
      )
    )!;
    const restored = normalizeEditorChatState(
      JSON.parse(JSON.stringify(stored))
    )!;
    const runtime = restored.messages[0].plan!.actions[0].runtime!;
    expect(fingerprint(runtime.request)).toBe(fingerprint(request));
    expect(runtime.request!.maxCredits).toBe(100000);
    expect(runtime.request!.references).toEqual(request.references);
    expect(runtime.request!.history).toEqual(request.history);
    expect(runtime.result).toBe(sourceEvidence);
    expect(runtime.generationId).toBe("paid-generation-id");
  });
  it("bounds retained history and drops unsupported executable action types", () => {
    const messages = Array.from({ length: 70 }, (_, index) => ({
      ...message,
      id: `message-${index}`,
      text: "x".repeat(8000),
      plan: {
        ...message.plan,
        actions: [{ ...action, kind: "arbitrary-http-request" }],
      },
    }));
    const state = normalizeEditorChatState({ messages })!;
    expect(state.messages.length).toBeLessThanOrEqual(60);
    expect(
      new TextEncoder().encode(JSON.stringify(state.messages)).byteLength
    ).toBeLessThanOrEqual(400000);
    expect(state.messages.at(-1)!.id).toBe("message-69");
    expect(
      state.messages.every(
        row => row.text.length <= 6000 && !row.plan!.actions.length
      )
    ).toBe(true);
  });
});
