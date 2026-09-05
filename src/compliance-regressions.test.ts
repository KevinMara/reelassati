import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("protected product and compliance invariants", () => {
  it("keeps the approved continuous entry-transition timing", () => {
    const entry = source("./components/entry/EntryAnimation.tsx");
    expect(entry).toContain("const BACKDROP_FADE_START_MS = 620;");
    expect(entry).toContain("const BACKDROP_FADE_DURATION_MS = 620;");
    expect(entry).toContain("const LOCKUP_FADE_START_MS = 940;");
    expect(entry).toContain("const LOCKUP_FADE_DURATION_MS = 360;");
    expect(entry).toContain('{ name: "bottom", delay: 0.08 }');
    expect(entry).toContain('{ name: "middle", delay: 0.16 }');
    expect(entry).toContain('{ name: "top", delay: 0.24 }');
    expect(entry).toContain("delay: 0.4 + index * 0.048");
  });

  it("locks the requested Studio navigation order and groups", () => {
    const dashboard = source("./pages/Dashboard.tsx");
    const navBlock = dashboard.slice(
      dashboard.indexOf("const navItems:"),
      dashboard.indexOf("  return (", dashboard.indexOf("const navItems:"))
    );
    const destinations = Array.from(navBlock.matchAll(/to: "([^"]+)"/g)).map(
      match => match[1]
    );
    expect(destinations).toEqual([
      "/dashboard",
      "/dashboard/trends",
      "/dashboard/script",
      "/dashboard/edit",
      "/dashboard/analyze",
      "/dashboard/publish",
      "/dashboard/analytics",
      "/dashboard/clients",
      "/dashboard/calendar",
      "/dashboard/coaching",
      "/dashboard/library",
      "/dashboard/social",
      "/dashboard/referral",
      "/dashboard/billing",
      "/dashboard/feedback",
      "/dashboard/settings",
      "/dashboard/status",
    ]);
    const navEntries = navBlock.slice(navBlock.indexOf("> = ["));
    expect((navEntries.match(/separator: true/g) || []).length).toBe(3);
    expect(navEntries).toContain('{ group: "create" }');
    expect(dashboard).toContain('label="Video"');
    expect(dashboard).toContain('to="/dashboard/video"');
    expect(dashboard).toContain('label="Images"');
    expect(dashboard).toContain('to="/dashboard/image"');
    expect(dashboard).toContain('label="Audio"');
    expect(dashboard).toContain('to="/dashboard/voice"');
    expect(dashboard).toContain(
      '<Navigate to="/dashboard/script?mode=interview" replace />'
    );
  });

  it("keeps drag-and-drop coverage beside every Studio file picker", () => {
    const files = [
      "./pages/dashboard/VoiceNotes.tsx",
      "./pages/dashboard/VideoAnalyzer.tsx",
      "./pages/dashboard/ContentLibrary.tsx",
      "./pages/dashboard/EditorPage.tsx",
    ].map(source);
    const fileInputs = files.reduce(
      (count, text) => count + (text.match(/type="file"/g) || []).length,
      0
    );
    const dropZones = files.reduce(
      (count, text) => count + (text.match(/useFileDropZone\(/g) || []).length,
      0
    );
    expect(fileInputs).toBe(5);
    expect(dropZones).toBeGreaterThanOrEqual(fileInputs);
    for (const text of files) expect(text).toContain("useFileDropZone(");
  });

  it("keeps disclosure language release-specific and approval-invalidating", () => {
    const publisher = source("./pages/dashboard/PublisherPage.tsx");
    expect(publisher).toContain('useState<ReleaseDisclosureLanguage>("unset")');
    expect(publisher).toMatch(
      /setDisclosureLanguage\(option\.value\);\s+invalidateReleaseReview\(\);/
    );
    expect(publisher).not.toContain(
      'workspace.profile.language === "it" ? "it" : "en"'
    );
  });
});
