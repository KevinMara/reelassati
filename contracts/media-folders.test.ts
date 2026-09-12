import { it, expect } from "vitest";
import { normalizeMediaFolders } from "./media-folders";
it("rejects malformed folders and duplicate identifiers", () => {
  expect(
    normalizeMediaFolders([
      null,
      {},
      { id: "a", name: " A " },
      { id: "a", name: "Duplicate" },
    ])
  ).toEqual([{ id: "a", name: "A" }]);
});
it("keeps valid nesting and repairs cycles and orphan parents", () => {
  const folders = normalizeMediaFolders([
    { id: "a", name: "A", parentId: "b" },
    { id: "b", name: "B", parentId: "a" },
    { id: "c", name: "C", parentId: "missing" },
  ]);
  expect(folders[0].parentId).toBeUndefined();
  expect(folders[1].parentId).toBe("a");
  expect(folders[2].parentId).toBeUndefined();
});
