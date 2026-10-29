import { describe, expect, it } from "vitest";
import {
  autonomousResultReceipt,
  persistedAutonomousReceipt,
} from "./autonomous-result-receipt";
import type { EditOperation, EditProject } from "@contracts/workspace";
import type { EditorChatMessage } from "@contracts/editor-chat";

describe("auto-edit execution receipt", () => {
  it("reports unavailable sound omissions without claiming they were applied", () => {
    const receipt = autonomousResultReceipt(
      "Added three sound cues",
      [{ type: "style" }],
      {
        changes: [],
        omitted: [],
        warnings: [],
        omittedSounds: [
          { operationId: "missing", label: "Cue", reason: "Unavailable audio" },
        ],
      },
      text => text
    );
    expect(receipt.summary).toBe("Updated the visual treatment.");
    expect(receipt.details).toEqual(["Skipped sound cues: 1."]);
  });
  it("cannot repeat a planner's discarded-overlay claim in the saved answer", () => {
    const receipt = autonomousResultReceipt(
      "Added scorecards and the missing score range",
      [{ type: "sound" }, { type: "audio" }] as EditOperation[],
      {
        changes: [],
        warnings: [],
        omitted: [
          {
            operationId: "card",
            label: "Score card",
            issues: [
              {
                reason: "unsupported-source-copy",
                detail: "Untrusted proposal detail",
              },
              { reason: "source-overlap", detail: "Untrusted proposal detail" },
            ],
          },
        ],
      },
      text => text
    );
    expect(receipt.summary).toBe("Updated the sound.");
    expect(receipt.details).toEqual([
      "Skipped overlays: 1. Overlay adds unsupported text. Overlay would cover source content.",
    ]);
    expect(receipt.planSummary).toBe(
      "Added scorecards and the missing score range"
    );
    expect(receipt.summary).not.toMatch(
      /Added scorecards|missing score|Untrusted/
    );
  });
  it("does not claim verified placement for requested overlays with unknown coverage", () => {
    const receipt = autonomousResultReceipt(
      "Safely placed your title",
      [{ type: "graphic" }] as EditOperation[],
      {
        changes: [],
        omitted: [],
        warnings: [
          {
            operationId: "title",
            label: "Title",
            issues: [
              {
                reason: "unknown-source-layout",
                detail: "Unknown",
                uncertain: true,
              },
            ],
          },
        ],
      },
      text => text
    );
    expect(receipt.details).toContain("Source layout is unverified.");
    expect(receipt.summary).toBe("Updated the graphics.");
    expect(receipt.summary).not.toContain("Safely placed");
  });
  it("uses a neutral fallback and can report preparation independently of omitted proposals", () => {
    const review = {
      changes: [],
      warnings: [],
      omitted: [
        {
          operationId: "card",
          label: "Card",
          issues: [
            {
              reason: "unsupported-source-copy" as const,
              detail: "Unsupported",
            },
          ],
        },
      ],
    };
    expect(
      autonomousResultReceipt("Added a card", [], review, text => text).summary
    ).toBe("Edit saved.");
    expect(
      autonomousResultReceipt(
        "Added a card",
        [{ type: "caption" }],
        review,
        text => text
      ).summary
    ).toBe("Updated the captions.");
    expect(
      autonomousResultReceipt(
        "Added a card",
        [{ type: "style" }],
        review,
        text => text
      ).summary
    ).toBe("Updated the visual treatment.");
  });
  it("always describes applied categories even when the plan needed no omissions", () => {
    const receipt = autonomousResultReceipt(
      "Preserve the complete demonstration and add an authoritative title",
      [
        { type: "sound" },
        { type: "audio" },
        { type: "style" },
        { type: "caption" },
      ],
      { changes: [], omitted: [], warnings: [] },
      text => text
    );
    expect(receipt.summary).toBe(
      "Updated the sound. Updated the visual treatment."
    );
    expect(receipt.details).toEqual([]);
    expect(receipt.planSummary).toBe(
      "Preserve the complete demonstration and add an authoritative title"
    );
    expect(
      autonomousResultReceipt(
        "Added a title",
        [],
        { changes: [], omitted: [], warnings: [] },
        text => text
      ).summary
    ).toBe("Edit saved.");
  });
});

describe("display-only receipts for saved auto-edit messages", () => {
  const message = {
    id: "auto",
    role: "assistant",
    createdAt: "2026-10-26T09:00:00Z",
    status: "completed",
    text: "Planned explanatory title",
    activity: {
      kind: "auto-edit",
      steps: ["Quiet cue", "Title", "Saved the finished edit"],
    },
  } as EditorChatMessage;
  const project = {
    id: "project",
    editorChat: {
      messages: [message, { id: "later", createdAt: "2026-10-26T09:05:00Z" }],
    },
    revisions: [{ label: "Auto-edit", createdAt: "2026-10-26T09:01:00Z" }],
    proposedChanges: [
      {
        type: "sound",
        label: "Quiet cue",
        status: "accepted",
        reviewedAt: "2026-10-26T09:00:30Z",
      },
      { type: "graphic", label: "Title", status: "proposed" },
      {
        type: "caption",
        label: "Unrelated",
        status: "accepted",
        reviewedAt: "2026-10-26T09:00:30Z",
      },
      {
        type: "graphic",
        label: "Title",
        status: "accepted",
        reviewedAt: "2026-10-26T09:03:00Z",
      },
    ],
  } as unknown as EditProject;
  it("uses only exact saved steps applied before that run's completed revision", () => {
    expect(persistedAutonomousReceipt(message, project, text => text)).toBe(
      "Updated the sound."
    );
    expect(message.text).toBe("Planned explanatory title");
    expect(project.proposedChanges[1].status).toBe("proposed");
  });
  it("does not borrow actions from another selected project or incomplete history", () => {
    expect(
      persistedAutonomousReceipt(
        message,
        { ...project, editorChat: undefined },
        text => text
      )
    ).toBe("Edit saved.");
    expect(
      persistedAutonomousReceipt(
        message,
        { ...project, revisions: [] },
        text => text
      )
    ).toBe("Edit saved.");
    expect(
      persistedAutonomousReceipt(
        { ...message, status: "running" },
        project,
        text => text
      )
    ).toBeUndefined();
    expect(
      persistedAutonomousReceipt(
        { ...message, activity: undefined },
        project,
        text => text
      )
    ).toBeUndefined();
  });
  it("keeps completed execution and preparation receipts when older revision history is trimmed", () => {
    const completed = {
      ...message,
      activity: {
        ...message.activity!,
        appliedTypes: ["caption", "trim"] as const,
      },
    };
    const saved = {
      ...completed,
      activity: {
        ...completed.activity,
        appliedTypes: [...completed.activity.appliedTypes],
      },
    };
    expect(
      persistedAutonomousReceipt(
        saved,
        {
          ...project,
          revisions: [],
          proposedChanges: [],
          editorChat: { mode: "ask", maxCredits: 100, messages: [saved] },
        },
        text => text
      )
    ).toBe("Updated the captions. Refined the pacing and cuts.");
  });
});
