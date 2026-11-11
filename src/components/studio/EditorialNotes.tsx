import type { EditorialNote } from "@contracts/editorial-notes";

/** Questions and material limitations remain visible; routine rationale stays
 * available without overwhelming the edit and its actual execution receipt. */
export function EditorialNotes({
  notes,
  label,
}: {
  notes?: EditorialNote[];
  label: string;
}) {
  if (!notes?.length) return null;
  const decisions = notes.filter(note => note.kind === "decision");
  const important = notes.filter(note => note.kind !== "decision");
  return (
    <aside
      aria-label={label}
      className="mt-3 space-y-2 text-[13px] leading-relaxed"
    >
      {important.map(note => (
        <p
          key={`${note.kind}:${note.text}`}
          className={`whitespace-pre-wrap break-words ${note.kind === "question" ? "font-medium" : "text-foreground/75"}`}
        >
          {note.text}
        </p>
      ))}
      {!!decisions.length && (
        <details className="text-foreground/65">
          <summary className="cursor-pointer text-xs">{label}</summary>
          <div className="mt-2 space-y-2">
            {decisions.map(note => (
              <p key={note.text} className="whitespace-pre-wrap break-words">
                {note.text}
              </p>
            ))}
          </div>
        </details>
      )}
    </aside>
  );
}
