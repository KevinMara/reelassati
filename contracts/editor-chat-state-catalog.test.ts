import { describe, expect, it } from "vitest";
import { normalizeEditorChatState } from "./editor-chat-state";
import { editorAudioCatalog } from "./editor-audio-catalog";

const entry = editorAudioCatalog[0];
const action = {
  id: "free-sound",
  kind: "catalog-audio",
  catalogId: entry.id,
  label: "Add whoosh",
  reason: "Requested",
  scope: "requested",
  requestExcerpt: "add a whoosh",
  credits: 0,
  dependsOn: [],
  status: "pending",
  insert: { start: 4, duration: entry.duration },
};
function persisted(rawAction: unknown, range?: { start: number; end: number }) {
  const state = {
    mode: "ask",
    maxCredits: 100,
    messages: [
      {
        id: "reply",
        role: "assistant",
        text: "Adding your sound",
        createdAt: "2026-09-19T00:00:00.000Z",
        range,
        plan: {
          requestId: "request-1234567890",
          projectId: "edit",
          actions: [rawAction],
        },
      },
    ],
  };
  return normalizeEditorChatState(JSON.parse(JSON.stringify(state)))!
    .messages[0].plan!.actions;
}

describe("catalog actions survive workspace persistence", () => {
  it("round-trips exact short-SFX timing, saved asset and lifecycle state", () => {
    const original = {
      ...action,
      status: "completed",
      runtime: { assetId: "saved-audio", detail: "Sound saved and placed" },
    };
    const restored = persisted(original);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject(original);
  });
  it("keeps Library-only actions and canonicalizes free catalog cost", () => {
    const restored = persisted({ ...action, insert: undefined, credits: 999 });
    expect(restored[0]).toMatchObject({
      kind: "catalog-audio",
      catalogId: entry.id,
      credits: 0,
    });
    expect(restored[0]).not.toHaveProperty("insert");
  });
  it.each([
    { catalogId: "invented-sound" },
    { insert: { start: -1, duration: entry.duration } },
    { insert: { start: 86400, duration: entry.duration } },
    { insert: { start: 4, duration: entry.duration + 1 } },
    { insert: { start: 4, duration: 0 } },
    { insert: { start: 4 } },
    { insert: "invalid" },
  ])(
    "discards malformed catalog actions rather than making them executable: %j",
    patch => {
      expect(persisted({ ...action, ...patch })).toEqual([]);
    }
  );
  it("enforces the saved selected range without dropping a valid contained action", () => {
    expect(persisted(action, { start: 5, end: 10 })).toEqual([]);
    expect(
      persisted(action, { start: 4, end: 4 + entry.duration })
    ).toHaveLength(1);
    expect(
      persisted(action, { start: 4, end: 4 + entry.duration / 2 })
    ).toEqual([]);
  });
});
