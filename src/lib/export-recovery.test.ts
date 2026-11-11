import { expect, it, vi } from "vitest";
import {
  isExportModuleUnavailable,
  saveBeforeExportRefresh,
} from "./export-recovery";

it("recognizes deployment chunks without classifying ordinary media failures", () => {
  expect(
    isExportModuleUnavailable(
      new TypeError(
        "Failed to fetch dynamically imported module: https://example.test/assets/render-old.js"
      )
    )
  ).toBe(true);
  expect(
    isExportModuleUnavailable(
      new TypeError("Importing a module script failed.")
    )
  ).toBe(true);
  expect(isExportModuleUnavailable(new Error("Audio download failed"))).toBe(
    false
  );
});
it("refreshes only after an acknowledged unchanged snapshot", async () => {
  const refresh = vi.fn(),
    saved = { revision: 8, title: "Saved" };
  expect(
    await saveBeforeExportRefresh(
      async () => saved,
      () => ({ ...saved }),
      refresh
    )
  ).toBe(true);
  expect(refresh).toHaveBeenCalledOnce();
  refresh.mockClear();
  expect(
    await saveBeforeExportRefresh(
      async () => saved,
      () => ({ ...saved, title: "Still saving" }),
      refresh
    )
  ).toBe(false);
  await expect(
    saveBeforeExportRefresh(
      async () => {
        throw new Error("Network");
      },
      () => saved,
      refresh
    )
  ).rejects.toThrow("Network");
  expect(refresh).not.toHaveBeenCalled();
});
