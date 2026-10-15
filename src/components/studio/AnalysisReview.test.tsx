import { beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import type { Asset } from "@contracts/workspace";
import {
  VIDEO_ANALYSIS_SCHEMA_VERSION,
  type VideoInsight,
} from "@contracts/video-analysis";
import { AnalysisReview } from "./AnalysisReview";

const language = createInstance();
beforeAll(async () => {
  await language.init({
    lng: "en",
    fallbackLng: "en",
    keySeparator: false,
    resources: { en: { ui: {} } },
    interpolation: { escapeValue: false },
  });
});
const asset: Asset = {
  id: "review-test",
  name: "Source.mp4",
  kind: "video",
  contentType: "video/mp4",
  size: 100,
  url: "/source.mp4",
  status: "ready",
  createdAt: "2026-10-15",
  duration: 4,
  width: 720,
  height: 1280,
};
const insight: VideoInsight = {
  start: 0,
  end: 4,
  role: "hook",
  roleReason: "The first shot states the video's promise.",
  label: "Opening promise",
  attention: 90,
  stimulation: 20,
  processingLoad: 90,
  clarity: 90,
  confidence: 0.9,
  visualEvidence: "A single title states the promise in the opening shot.",
  audioEvidence:
    "The speaker states the same promise without background music.",
  strength: "The opening promise is specific.",
  improvement: "Reduce simultaneous concepts before introducing evidence.",
  rationale:
    "Competing ideas raise processing demands even when the promise attracts attention.",
};
const render = (result: Parameters<typeof AnalysisReview>[0]["result"]) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n: language },
      createElement(AnalysisReview, { asset, result })
    )
  );

describe("versioned video evidence presentation", () => {
  it("does not turn legacy attention notes into overall scores or Other sections", () => {
    const markup = render({
      retention: [
        { start: 0, end: 4, score: 90, note: "Old attention estimate" },
      ],
    });
    expect(markup).toContain("Incomplete report");
    expect(markup).toContain("Overall score unavailable");
    expect(markup).not.toContain("ar-score-orbit is-scored");
    expect(markup).not.toContain(">90<");
    expect(markup).not.toContain(">Other<");
    expect(markup).not.toContain("Old attention estimate");
  });
  it("uses the shared editorial calculation instead of the highest channel as overall", () => {
    const markup = render({
      schemaVersion: VIDEO_ANALYSIS_SCHEMA_VERSION,
      insights: [insight],
    });
    expect(markup).toContain("ar-score-orbit is-scored");
    expect(markup).toMatch(/<strong>74<\/strong><span>\/ 100<\/span>/);
    expect(markup).toContain("Reduce simultaneous concepts");
    expect(markup).toContain("The opening promise is specific.");
  });
  it("withholds the overall score when any required channel is missing", () => {
    const markup = render({
      schemaVersion: VIDEO_ANALYSIS_SCHEMA_VERSION,
      insights: [{ ...insight, clarity: null }],
    });
    expect(markup).not.toContain("ar-score-orbit is-scored");
    expect(markup).toContain(
      "Full coverage and all four signals are required."
    );
    expect(markup).toContain("Unavailable");
  });
  it("shows an assessed absent CTA without inventing a CTA interval", () => {
    const markup = render({
      schemaVersion: VIDEO_ANALYSIS_SCHEMA_VERSION,
      insights: [insight],
      structure: [
        {
          role: "cta",
          status: "absent",
          note: "No explicit viewer action is requested.",
        },
      ],
    });
    expect(markup).toContain("No explicit viewer action is requested.");
    expect(markup).toContain("Absent");
    expect(markup).not.toContain("Select CTA");
  });
});
