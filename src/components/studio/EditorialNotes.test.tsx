import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorialNotes } from "./EditorialNotes";

it("renders source limitations and the question visibly as chat notes, escaping source text", () => {
  const html = renderToStaticMarkup(
    <EditorialNotes
      label="Note di montaggio"
      notes={[
        { kind: "decision", text: "La pausa lascia leggere la dimostrazione." },
        { kind: "limitation", text: "<script>Un testo già nel video</script>" },
        { kind: "question", text: "Hai una versione senza la scritta?" },
      ]}
    />
  );
  expect(html).toContain('aria-label="Note di montaggio"');
  expect(html).toContain("La pausa lascia leggere la dimostrazione.");
  expect(html).toContain("Hai una versione senza la scritta?");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toMatch(/<details|hidden|<button/);
});

it("adds no empty note section to legacy chats", () => {
  expect(renderToStaticMarkup(<EditorialNotes label="Notes" />)).toBe("");
});
