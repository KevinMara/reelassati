import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  catalogImportStatus: vi.fn(),
  catalogImportManifest: vi.fn(),
  catalogImportObject: vi.fn(),
}));
vi.mock("@/lib/platform-api", () => ({
  platformApi: api,
  captureUploadRequestScope: vi.fn(),
}));
vi.mock("@/lib/i18n/ui", () => ({
  useUiText: () => (text: string) => text,
  getUiLocale: () => "en",
}));
import { SharedCatalogImport } from "./SharedCatalogImport";

describe("shared catalog owner panel", () => {
  it("requires an explicit prepared folder and start action before any request", () => {
    const html = renderToStaticMarkup(<SharedCatalogImport />);
    expect(html).toContain("Shared catalog import");
    expect(html).toContain('webkitdirectory=""');
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Start \/ resume import<\/button>/
    );
    for (const call of Object.values(api)) expect(call).not.toHaveBeenCalled();
  });
});
