import { describe, expect, it } from "vitest";
import { createEmptyWorkspace, type Asset } from "@contracts/workspace";
import { nextMediaLinkRefresh, renewWorkspaceMediaLinks } from "./workspace-media-links";

const asset = (id = "a", expires = 1000): Asset => ({
  id, name: "My renamed clip", kind: "video", contentType: "video/mp4", size: 42,
  url: `https://media.example/api/media/${id}?expires=${expires}&token=signature`,
  status: "ready", createdAt: "2026-11-13", folderId: "local-folder",
});
describe("workspace media renewal", () => {
  it("renews only links without overwriting unsaved edits or importing deleted files", () => {
    const current = { ...createEmptyWorkspace("creator@example.com"), assets: [asset()], revision: 4 };
    const fresh = { ...asset("a", 2000), name: "Old server name", folderId: "old-folder" };
    const renewed = renewWorkspaceMediaLinks(current, [fresh, asset("deleted", 2000)]);
    expect(renewed.assets).toEqual([{ ...current.assets[0], url: fresh.url }]);
    expect(renewed.projects).toBe(current.projects);
    expect(renewed.revision).toBe(4);
  });
  it("does not replace a changed source or roll a fresher signature back", () => {
    const current = { ...createEmptyWorkspace("creator@example.com"), assets: [asset("a", 2000)] };
    expect(renewWorkspaceMediaLinks(current, [asset("a", 1000)])).toBe(current);
    expect(renewWorkspaceMediaLinks(current, [{ ...asset("a", 3000), url: asset("other", 3000).url }])).toBe(current);
    expect(renewWorkspaceMediaLinks(current, [{ ...asset("a", 3000), url: "https://other.example/api/media/a?expires=3000&token=x" }])).toBe(current);
  });
  it("schedules before expiry and recognizes already expired links", () => {
    expect(nextMediaLinkRefresh([asset()], 900000)).toBe(40000);
    expect(nextMediaLinkRefresh([asset()], 1000000)).toBe(0);
    expect(nextMediaLinkRefresh([{ ...asset(), url: "blob:local" }])).toBeNull();
  });
});
