import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createEmptyWorkspace, type EditProject } from "@contracts/workspace";
import { EditorCreationDock } from "./EditorCreationDock";

const workspace = createEmptyWorkspace("qa@example.test");
workspace.assets = [
  {
    id: "clip-source",
    name: "Product demo.mp4",
    kind: "video",
    status: "ready",
    duration: 4,
    size: 100,
    contentType: "video/mp4",
    url: "/qa.mp4",
    createdAt: "2026-10-20",
  },
];
vi.mock("@/providers/workspace", () => ({
  useWorkspace: () => ({
    workspace,
    capabilities: { uploads: false },
    updateWorkspace: vi.fn(),
    getWorkspaceSnapshot: () => workspace,
  }),
}));
vi.mock("@/lib/i18n/ui", () => ({
  getUiLocale: () => "en",
  useUiText: () => (text: string, values?: Record<string, string>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => values?.[key] ?? key),
}));
afterEach(() => vi.unstubAllGlobals());

describe("editor Library actions", () => {
  it("exposes direct insertion through the production media dock rather than requiring drag", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    const html = renderToStaticMarkup(
      <EditorCreationDock
        project={
          { id: "project", clips: [], transcript: [] } as unknown as EditProject
        }
        playhead={12.5}
        activeTool="library"
        onToolChange={vi.fn()}
        captions={null}
        effects={null}
        onInsert={vi.fn()}
        onGraphic={vi.fn()}
        onMotionKit={vi.fn()}
      />
    );
    expect(html).toContain('aria-label="Add Product demo.mp4 to timeline"');
    expect(html).toContain('aria-label="Insert position"');
    expect(html).not.toContain(
      "Click to preview · drag to place on the timeline"
    );
  });
});
