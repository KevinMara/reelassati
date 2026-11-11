import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorialCoverage } from "./EditorialCoverage";
import type { EditorialCoverageReview } from "@contracts/editorial-coverage";
import { editorCoverageUi } from "@/lib/i18n/locales/ui-editor-coverage";

const review: EditorialCoverageReview = {
  version: 1,
  status: "partial",
  scenes: [
    {
      sceneId: "scene:0",
      start: 0,
      end: 5,
      purpose: "Show the missing step",
      decision: "improve",
      reason: "The source introduces the subject without demonstrating it.",
      speechIds: ["speech:0"],
      observationIndexes: [],
      operationIds: ["grade"],
      issues: ["cosmetic-only"],
    },
    {
      sceneId: "scene:1",
      start: 5,
      end: 10,
      purpose: "Retain the clear result",
      decision: "preserve",
      reason: "The prop and measured words already show the result.",
      speechIds: ["speech:1"],
      observationIndexes: [],
      operationIds: [],
      issues: [],
    },
  ],
};
describe("chat content decisions", () => {
  it("shows unresolved content alongside a supported preserve reason, separate from video", () => {
    const html = renderToStaticMarkup(
      <EditorialCoverage review={review} ui={text => text} />
    );
    expect(html).toContain("Content decisions");
    expect(html).toContain(
      "The planned operations do not resolve this content need."
    );
    expect(html).toContain(
      "The prop and measured words already show the result."
    );
    expect(html).toContain('data-content-decision="preserve"');
    expect(html).not.toContain("<video");
    expect(html).not.toContain("<canvas");
  });
  it("has complete nonempty UI copy in all 28 supported locales", () => {
    expect(Object.keys(editorCoverageUi)).toHaveLength(28);
    for (const entries of Object.values(editorCoverageUi)) {
      expect(Object.keys(entries)).toEqual(Object.keys(editorCoverageUi.en));
      expect(
        Object.values(entries).every(
          value => typeof value === "string" && value.trim()
        )
      ).toBe(true);
      expect(entries["Content decisions need review: {count}."]).toContain(
        "{count}"
      );
    }
    const html = renderToStaticMarkup(
      <EditorialCoverage
        review={review}
        ui={text => editorCoverageUi.it[text] ?? text}
      />
    );
    expect(html).toContain("Scelte sui contenuti");
    expect(html).toContain("Le operazioni previste non risolvono");
  });
});
