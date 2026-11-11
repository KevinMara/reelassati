import type { EditorialNote } from "@contracts/editorial-notes";

/** Keep reasoning/questions visible without presenting proposal text as an
 * execution receipt or converting it to editable/on-screen video content. */
export function EditorialNotes({
  notes,
  label,
}: {
  notes?: EditorialNote[];
  label: string;
}) {
  if (!notes?.length) return null;
  return (
    <aside
      aria-label={label}
      className="mt-3 space-y-2 text-[13px] leading-relaxed"
    >
      <p className="text-[11px] font-medium text-foreground/55">{label}</p>
      {notes.map(note => (
        <p
          key={`${note.kind}:${note.text}`}
          className={`whitespace-pre-wrap break-words ${note.kind === "question" ? "font-medium" : "text-foreground/75"}`}
        >
          {note.text}
        </p>
      ))}
    </aside>
  );
}
