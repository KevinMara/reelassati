import { describe, expect, it } from "vitest";
import type { EditProject } from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import {
  applyChatCompletion,
  changeChatScopeDecision,
  mergeChatTranscript,
} from "./editor-chat-safety";

function fixture(status: EditorChatAction["status"] = "running"): EditProject {
  return {
    id: "project",
    updatedAt: "2026-09-19T12:00:00.000Z",
    duration: 20,
    clips: [],
    transcript: [],
    revisions: [],
    proposedChanges: [],
    editorChat: {
      mode: "ask",
      maxCredits: 100,
      messages: [
        {
          id: "message",
          role: "assistant",
          text: "Working",
          createdAt: "2026-09-19T12:00:00.000Z",
          plan: {
            projectId: "project",
            projectUpdatedAt: "2026-09-19T12:00:00.000Z",
            actions: [
              {
                id: "action",
                kind: "transcribe",
                assetIds: ["video"],
                replace: true,
                scope: "requested",
                status,
                credits: 1,
                label: "Add captions",
                reason: "Requested",
                requestExcerpt: "Add captions",
                dependsOn: [],
              },
            ],
          },
        },
      ],
    },
  } as unknown as EditProject;
}

const savedAction = (project: EditProject) =>
  project.editorChat!.messages[0].plan!.actions[0];

describe("chat completion commits", () => {
  it("does not overwrite a manual caption edit made while a transcription was pending", () => {
    const project = fixture();
    project.updatedAt = "2026-09-19T12:00:01.000Z";
    project.transcript = [
      { id: "manual", start: 0, end: 3, text: "A manually corrected name" },
    ];
    let applied = false;
    const saved = applyChatCompletion(project, "message", "action", {
      timelineMutation: true,
      detail: "Captions added",
      transform: latest => {
        applied = true;
        return { ...latest, transcript: [] };
      },
    });
    expect(applied).toBe(false);
    expect(saved.transcript).toEqual(project.transcript);
    expect(savedAction(saved).status).toBe("blocked");
    expect(saved.editorChat!.messages[0].plan!.projectUpdatedAt).toBe(
      "2026-09-19T12:00:00.000Z"
    );
  });

  it("does not let a read-only analysis hide a manual change from the remaining plan", () => {
    const project = fixture();
    project.updatedAt = "2026-09-19T12:00:01.000Z";
    const saved = applyChatCompletion(project, "message", "action", {
      timelineMutation: false,
      detail: "Analysis saved",
      transform: latest => ({ ...latest, sourceReviews: [] }),
    });
    expect(savedAction(saved).status).toBe("completed");
    expect(saved.updatedAt).toBe(project.updatedAt);
    expect(saved.editorChat!.messages[0].plan!.projectUpdatedAt).not.toBe(
      project.updatedAt
    );
  });

  it("advances the baseline only after saving a mutation from that baseline", () => {
    const saved = applyChatCompletion(fixture(), "message", "action", {
      timelineMutation: true,
      detail: "Captions added",
      transform: latest => ({
        ...latest,
        updatedAt: "2026-09-19T12:00:02.000Z",
        transcript: [{ id: "new", start: 1, end: 3, text: "Hello" }],
      }),
    });
    expect(saved.transcript[0].text).toBe("Hello");
    expect(saved.editorChat!.messages[0].plan!.projectUpdatedAt).toBe(
      saved.updatedAt
    );
    expect(savedAction(saved).status).toBe("completed");
  });

  it("does not execute a completed action again when a recovery response arrives twice", () => {
    const project = fixture("completed");
    expect(
      applyChatCompletion(project, "message", "action", {
        timelineMutation: true,
        detail: "Again",
        transform: () => {
          throw new Error("Must not run twice");
        },
      })
    ).toBe(project);
  });
});

describe("inline approval transitions", () => {
  it("approves an optional action without granting a budget or touching other actions", () => {
    const action = {
      ...savedAction(fixture("awaiting-approval")),
      scope: "extra",
    } as EditorChatAction;
    const approved = changeChatScopeDecision(action, "approve");
    expect(approved).toMatchObject({
      status: "pending",
      credits: 1,
      runtime: { approved: true },
    });
    expect(action.status).toBe("awaiting-approval");
  });

  it.each([
    "running",
    "completed",
    "interrupted",
    "failed",
    "skipped",
  ] as const)("cannot requeue %s work from a stale approval card", status => {
    const action = {
      ...savedAction(fixture(status)),
      scope: "extra",
    } as EditorChatAction;
    expect(changeChatScopeDecision(action, "approve")).toBe(action);
    expect(changeChatScopeDecision(action, "skip")).toBe(action);
  });

  it("does not approve a pending generation that already carries an execution ID", () => {
    const action = {
      ...savedAction(fixture("pending")),
      scope: "extra",
      runtime: { generationId: "already-submitted" },
    } as EditorChatAction;
    expect(changeChatScopeDecision(action, "approve")).toBe(action);
  });
});

describe("time-range caption edits", () => {
  it("replaces only the selected range, preserving captions on both sides", () => {
    const project = fixture();
    project.transcript = [
      { id: "spans", start: 0, end: 12, text: "Existing subtitle" },
    ];
    const result = mergeChatTranscript(
      project,
      [{ id: "new", start: 2, end: 11, text: "New words" }],
      true,
      { start: 4, end: 8 }
    );
    expect(
      result.map(({ start, end, text }) => ({ start, end, text }))
    ).toEqual([
      { start: 0, end: 4, text: "Existing subtitle" },
      { start: 4, end: 8, text: "New words" },
      { start: 8, end: 12, text: "Existing subtitle" },
    ]);
    expect(new Set(result.map(segment => segment.id)).size).toBe(3);
  });

  it("keeps outside portions even when appending a same-ID corrected source segment", () => {
    const project = fixture();
    project.transcript = [
      { id: "same", start: 0, end: 12, text: "Existing subtitle" },
    ];
    const result = mergeChatTranscript(
      project,
      [{ id: "same", start: 2, end: 11, text: "Corrected" }],
      false,
      { start: 4, end: 8 }
    );
    expect(result.map(segment => [segment.start, segment.end])).toEqual([
      [0, 4],
      [4, 8],
      [8, 12],
    ]);
    expect(new Set(result.map(segment => segment.id)).size).toBe(3);
  });
});
