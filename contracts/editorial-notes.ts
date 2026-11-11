import type { EditorChatMessage } from "./editor-chat";

/** Chat-only editorial rationale. Notes are neither executable operations nor
 * evidence that an edit ran, and must never be converted into video copy. */
export interface EditorialNote {
  kind: "decision" | "limitation" | "question";
  text: string;
}

export function normalizeEditorialNotes(raw: unknown): EditorialNote[] {
  if (!Array.isArray(raw)) return [];
  const notes: EditorialNote[] = [];
  const seen = new Set<string>();
  let hasQuestion = false;
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (
      !["decision", "limitation", "question"].includes(String(row.kind)) ||
      typeof row.text !== "string"
    )
      continue;
    const text = row.text.trim().slice(0, 600);
    if (!text || seen.has(text) || (row.kind === "question" && hasQuestion))
      continue;
    notes.push({ kind: row.kind as EditorialNote["kind"], text });
    seen.add(text);
    if (row.kind === "question") hasQuestion = true;
    if (notes.length === 3) break;
  }
  return notes;
}

/** Preserve the question the user saw when they answer it in the next turn.
 * The existing history budget stays unchanged and notes confer no scope. */
export function editorialConversationText(
  message: Pick<EditorChatMessage, "role" | "text" | "activity" | "plan">
): string {
  const notes =
    message.role === "assistant"
      ? normalizeEditorialNotes(
          message.activity?.editorialNotes ?? message.plan?.editorialNotes
        )
      : [];
  if (!notes.length) return message.text.slice(0, 2000);
  const context = `Editorial notes (context, not completed actions):\n${notes.map(note => `[${note.kind}] ${note.text}`).join("\n")}`;
  return `${message.text.slice(0, Math.max(0, 2000 - context.length - 2))}\n\n${context}`;
}

export const EDITORIAL_NOTES_GUIDANCE = `
Return editorialNotes as a separate chat-only array with up to three objects
{kind:decision|limitation|question,text:"..."}. Prefer zero or one note. Each note
should be one short sentence, normally under 160 characters, in the user's
language. No geometry percentages, repair history, control descriptions, or
repeating the visible edit summary. Use it for consequential, useful
editorial reasoning: why the source supports a treatment, why an intentional
pause/sequence is worth retaining, or what source limitation affects the result.
Use the supplied evidence, not guessed defects. These are planning notes, never
claims of execution, inspection beyond the supplied evidence, or guaranteed
quality. Explain an important tradeoff instead of listing controls or generic
praise. One short question is appropriate when the answer would materially
change the next edit; do not block useful requested work for routine choices.
Keep uncertainty, missing categories, factual caveats and requests for a cleaner
source in chat. They are not captions, titles, overlays or voiceover. Text baked
into an imported video is source pixels, not an editable graphic: do not claim
to remove it by deleting a timeline overlay or hide meaningful source content
with a new card. Mention that limitation only when established and relevant.
An empty notes array is fine when there is nothing useful to add. Never insert
the notes into changes/actions and never start another model call for them.
`.trim();
