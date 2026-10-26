import { describe, expect, it } from "vitest";
import { autonomousResultReceipt } from "./autonomous-result-receipt";
import type { EditOperation } from "@contracts/workspace";

describe("auto-edit execution receipt", () => {
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
    expect(JSON.stringify(receipt)).not.toMatch(
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
});
