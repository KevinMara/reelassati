import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorialNotes } from "./EditorialNotes";

it("keeps questions and limitations visible while collapsing full decision rationale", () => {
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
  expect(html).toContain("<details");
  expect(html).not.toMatch(/<details[^>]* open/);
  const details = html.slice(
    html.indexOf("<details"),
    html.indexOf("</details>") + 10
  );
  expect(details).toContain("La pausa lascia leggere la dimostrazione.");
  expect(details).not.toContain("Hai una versione senza la scritta?");
  expect(details).not.toContain("&lt;script&gt;");
});

it("adds no empty note section to legacy chats", () => {
  expect(renderToStaticMarkup(<EditorialNotes label="Notes" />)).toBe("");
});
