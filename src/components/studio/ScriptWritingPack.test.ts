import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScriptWritingPack as WritingPack } from "@contracts/script-writing-pack";
import { normalizeScriptWritingPack } from "@contracts/script-writing-pack";
import { appendTextProvenanceMarker } from "@contracts/compliance";
import {
  ScriptBeatTable,
  ScriptCtaOptions,
  ScriptWritingPack,
} from "./ScriptWritingPack";

const scriptText =
  "Start with the result.\n\nShow the process.\n\nSave this example.";
const pack: WritingPack = {
  version: 1,
  clock: "planned",
  scriptText,
  hooks: Array.from({ length: 10 }, (_, index) => ({
    rank: index + 1,
    spoken:
      index === 0 ? "Start with the result." : `Opening option ${index + 1}.`,
    screenText: `Screen emphasis ${index + 1}`,
    reason: `Creative reason ${index + 1}: a concrete opening suited to the brief.`,
  })),
  beats: [
    {
      start: 0,
      end: 3,
      spoken: "Start with the result.",
      screenText: "See the result",
      visual: "Show the supplied finished example.",
    },
    {
      start: 3,
      end: 27,
      spoken: "Show the process.",
      screenText: "One step at a time",
      visual: "Demonstrate each step using the supplied product.",
    },
    {
      start: 27,
      end: 30,
      spoken: "Save this example.",
      screenText: "Keep the example",
      visual: "Hold on the final comparison.",
    },
  ],
  alternateCtas: [
    "Save these steps for later.",
    "Which step will you try first?",
  ],
};

function render(
  overrides: Partial<Parameters<typeof ScriptWritingPack>[0]> = {}
) {
  return renderToStaticMarkup(
    createElement(ScriptWritingPack, {
      pack,
      fullScript: scriptText,
      currentHook: pack.hooks[0].spoken,
      currentCta: "Save this example.",
      onUseHook: () => undefined,
      onUseCta: () => undefined,
      ...overrides,
    })
  );
}

describe("structured script writing options", () => {
  it("renders ten ranked openings with spoken and screen wording and selection reasons", () => {
    const html = render();
    expect(html.match(/aria-label="Use hook \d+"/g)).toHaveLength(10);
    for (let rank = 1; rank <= 10; rank++) {
      expect(html).toContain(`aria-label="Rank ${rank}"`);
      expect(html).toContain(`Screen emphasis ${rank}`);
      expect(html).toContain(`Creative reason ${rank}:`);
    }
    expect(html).toContain("Current opening");
    expect(html).toContain("Hooks are ranked for fit with this brief.");
    expect(html).toContain(
      "Beat timing is a plan; recorded speech may differ."
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain("10 hooks");
    expect(html).toContain("Beat plan");
    expect(html).toContain("Other CTAs");
  });

  it("preserves alternatives but marks the original plan stale after narration changes", () => {
    const html = render({
      fullScript:
        "A changed opening.\n\nShow the process.\n\nSave this example.",
    });
    expect(html).toContain("The spoken script has changed.");
    expect(html).toContain("revise the beat plan");
    expect(html.match(/aria-label="Use hook \d+"/g)).toHaveLength(10);
  });

  it("ignores whitespace and the opaque provenance marker when detecting spoken changes", () => {
    const fullScript = appendTextProvenanceMarker(
      "  Start with the result. Show the process. Save this example.  ",
      "0123456789abcdef_signed_record"
    );
    expect(render({ fullScript })).not.toContain(
      "The spoken script has changed."
    );
  });

  it("keeps saved legacy drafts usable and omits an invalid persisted plan whole", () => {
    const invalidPack = normalizeScriptWritingPack({ ...pack, hooks: [] }, 30);
    const html = render({ pack: invalidPack });
    expect(html).toContain("No writing plan is stored with this draft.");
    expect(html).toContain("You can still edit and save its script.");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain("Use hook");
  });

  it("escapes provider text and never selects or saves a variant while rendering", () => {
    let actions = 0;
    const unsafePack = {
      ...pack,
      hooks: pack.hooks.map((hook, index) =>
        index === 0
          ? {
              ...hook,
              spoken: '<img src=x onerror="alert(1)">',
              reason: "<script>unsafe()</script>",
            }
          : hook
      ),
    };
    const html = render({
      pack: unsafePack,
      onUseHook: () => {
        actions++;
      },
      onUseCta: () => {
        actions++;
      },
    });
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(actions).toBe(0);
  });

  it("disables all opening choices while the current script is saving", () => {
    const html = render({ disabled: true });
    expect(
      html.match(/aria-label="Use hook \d+"[^>]*disabled=""/g)
    ).toHaveLength(10);
  });
});

describe("planned script beat table", () => {
  it("separates planned seconds, spoken narration, screen copy and production direction", () => {
    const html = renderToStaticMarkup(
      createElement(ScriptBeatTable, { beats: pack.beats })
    );
    expect(html).toContain("Planned script timing in seconds");
    expect(html).toContain("0–3s");
    expect(html).toContain("3–27s");
    expect(html).toContain("27–30s");
    expect(html).toContain("24s");
    expect(html).toContain("Show the process.");
    expect(html).toContain("One step at a time");
    expect(html).toContain("Demonstrate each step using the supplied product.");
    expect(html.match(/scope="col"/g)).toHaveLength(4);
    expect(html.match(/scope="row"/g)).toHaveLength(3);
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("overflow-auto");
  });
});

describe("alternate calls to action", () => {
  it("offers both alternatives and identifies the one already in the editable script", () => {
    let actions = 0;
    const html = renderToStaticMarkup(
      createElement(ScriptCtaOptions, {
        ctas: pack.alternateCtas,
        currentCta: pack.alternateCtas[1],
        onUseCta: () => {
          actions++;
        },
      })
    );
    expect(html).toContain(pack.alternateCtas[0]);
    expect(html).toContain(pack.alternateCtas[1]);
    expect(html).toContain(
      'aria-label="Use call to action 2" aria-pressed="true" disabled=""'
    );
    expect(html).toContain("Current call to action");
    expect(actions).toBe(0);
  });
});
