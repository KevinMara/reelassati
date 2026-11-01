import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyWorkspace,
  type WorkspaceDocument,
} from "@contracts/workspace";

const state = vi.hoisted(() => ({
  email: "owner-a@example.com",
  loading: false,
  workspace: null as WorkspaceDocument | null,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: state.email, email: state.email },
    loading: false,
  }),
}));
vi.mock("@/providers/workspace", () => ({
  useWorkspace: () => ({
    workspace: state.workspace,
    loading: state.loading,
    saving: false,
    capabilities: { ai: true },
    getWorkspaceSnapshot: () => state.workspace,
    updateWorkspace: vi.fn(),
  }),
}));
vi.mock("@/components/studio/ReferenceStylePanel", () => ({
  ReferenceStylePanel: () => null,
}));

import ScriptGenerator from "./ScriptGenerator";

beforeEach(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => null });
  state.email = "owner-a@example.com";
  state.loading = false;
  state.workspace = createEmptyWorkspace(state.email);
  state.workspace.scripts.push({
    id: "private-draft-a",
    title: "Owner A private title",
    hook: "Owner A private opener",
    body: "Owner A private body",
    cta: "Owner A private CTA",
    fullScript:
      "Owner A private opener\n\nOwner A private body\n\nOwner A private CTA",
    platform: "tiktok",
    tone: "professional",
    duration: 30,
    language: "en",
    createdAt: "2026-10-10T00:00:00Z",
  });
});

function render(path = "/dashboard/scripts?script=private-draft-a") {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(ScriptGenerator)
    )
  );
}

describe("script workspace bootstrap ownership", () => {
  it("starts a new brief with Instagram and readable tone labels", () => {
    const html = render("/dashboard/script");
    expect(html).toContain(
      '<option value="instagram" selected="">Instagram Reels</option>'
    );
    expect(html).toContain(
      '<option value="energetic" selected="">Energetic</option>'
    );
    expect(html).toContain(
      '<option value="professional">Professional</option>'
    );
  });

  it("does not seed or display the prior owner's requested draft after an auth switch", () => {
    state.email = "owner-b@example.com";
    const html = render();
    expect(html).toContain("Opening your script workspace…");
    expect(html).not.toContain("Owner A private");
    expect(html).not.toContain("Save edits");
  });

  it("waits for the workspace load even when the displayed email still matches", () => {
    state.loading = true;
    const html = render();
    expect(html).toContain("Opening your script workspace…");
    expect(html).not.toContain("Owner A private");
    expect(html).not.toContain("Generate script ·");
  });

  it("opens the matching owner's legacy draft without requiring a writing pack", () => {
    const html = render();
    expect(html).toContain("Owner A private title");
    expect(html).toContain("Owner A private opener");
    expect(html).toContain("Owner A private body");
    expect(html).toContain("Owner A private CTA");
    expect(html).toContain("Save edits");
    expect(html).toContain("No writing plan is stored with this draft.");
    expect(html).not.toContain("Opening your script workspace…");
  });
});
