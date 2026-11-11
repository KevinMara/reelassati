import { describe, expect, it } from "vitest";
import {
  editorialConversationText,
  normalizeEditorialNotes,
} from "./editorial-notes";

describe("chat-only editorial notes", () => {
  it("bounds model prose and drops executable fields, duplicates and extra questions", () => {
    const raw = [
      null,
      { kind: "graphic", text: "Unrequested caveat" },
      {
        kind: "limitation",
        text: " The source already contains this title. ",
        operation: { type: "graphic" },
      },
      { kind: "limitation", text: "The source already contains this title." },
      {
        kind: "question",
        text: "Do you have a clean source?",
        actions: [{ kind: "generate" }],
      },
      { kind: "question", text: "Another question?" },
      { kind: "decision", text: "x".repeat(800) },
      { kind: "decision", text: "A fourth note" },
    ];
    expect(normalizeEditorialNotes(raw)).toEqual([
      { kind: "limitation", text: "The source already contains this title." },
      { kind: "question", text: "Do you have a clean source?" },
      { kind: "decision", text: "x".repeat(600) },
    ]);
    expect(raw[2]).toHaveProperty("operation");
  });
  it("allows a legacy response to omit notes without inventing guidance", () => {
    expect(normalizeEditorialNotes(undefined)).toEqual([]);
    expect(
      normalizeEditorialNotes({ kind: "decision", text: "Not an array" })
    ).toEqual([]);
    expect(normalizeEditorialNotes([{ kind: "question", text: "  " }])).toEqual(
      []
    );
  });
  it("keeps the visible question in the next turn's bounded conversation context", () => {
    const result = editorialConversationText({
      role: "assistant",
      text: "Updated the sound. ".repeat(160),
      activity: {
        kind: "auto-edit",
        steps: [],
        editorialNotes: [
          { kind: "decision", text: "d".repeat(600) },
          { kind: "limitation", text: "l".repeat(600) },
          { kind: "question", text: "Do you have the clean source?" },
        ],
      },
    });
    expect(result.length).toBeLessThanOrEqual(2000);
    expect(result).toContain("context, not completed actions");
    expect(result).toContain("[question] Do you have the clean source?");
    expect(
      editorialConversationText({
        role: "user",
        text: "Yes, use the clean source.",
      })
    ).toBe("Yes, use the clean source.");
  });
});
