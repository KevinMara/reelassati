import { describe, expect, it } from "vitest";
import type { Asset } from "@contracts/workspace";
import {
  assetOrigin,
  isStockCollection,
  libraryOrganizationMatches,
  DEFAULT_LIBRARY_ORGANIZATION,
} from "./library-organization";

const folders = [
  { id: "legacy", name: "Futuristic SFXs" },
  { id: "stock", name: "Reel Stock" },
  { id: "own", name: "Client footage" },
];
const asset = (patch: Partial<Asset> = {}): Asset => ({
  id: "asset",
  name: "Sound.wav",
  kind: "audio",
  contentType: "audio/wav",
  status: "ready",
  size: 20,
  createdAt: "2026-10-25T12:00:00.000Z",
  url: "/sound.wav",
  ...patch,
});

describe("stock library organization", () => {
  it.each(["Futuristic SFXs", "futuristic sfx", " Reel Stock ", "STOCK"])(
    "recognizes the stock collection %s",
    name => {
      expect(isStockCollection({ id: "folder", name })).toBe(true);
    }
  );
  it.each(["Stockholm trip", "Client stock references", "Futuristic campaign"])(
    "keeps user folder %s distinct",
    name => {
      expect(isStockCollection({ id: "folder", name })).toBe(false);
    }
  );
  it("finds old sound imports by their saved folder without renaming or losing them", () => {
    const sound = asset({ folderId: "legacy" });
    expect(assetOrigin(sound, folders)).toBe("stock");
    expect(
      libraryOrganizationMatches(
        sound,
        { ...DEFAULT_LIBRARY_ORGANIZATION, origin: "stock" },
        Date.now(),
        folders
      )
    ).toBe(true);
    expect(
      libraryOrganizationMatches(
        sound,
        { ...DEFAULT_LIBRARY_ORGANIZATION, folder: "legacy" },
        Date.now(),
        folders
      )
    ).toBe(true);
    expect(sound.folderId).toBe("legacy");
    expect(
      assetOrigin(sound, [{ id: "unrelated", name: "Futuristic SFXs" }])
    ).toBe("uploaded");
  });
  it("recognizes catalog and imported stock after moving them into another folder", () => {
    expect(
      assetOrigin(
        asset({ variantGroupId: "builtin-audio:sound", folderId: "own" }),
        folders
      )
    ).toBe("stock");
    expect(
      assetOrigin(
        asset({ variantGroupId: "stock:provider:item", folderId: "own" }),
        folders
      )
    ).toBe("stock");
    expect(assetOrigin(asset({ folderId: "own" }), folders)).toBe("uploaded");
    expect(assetOrigin(asset({ kind: "export" }), folders)).toBe("export");
  });
  it("combines the stock source filter with folder and date limits", () => {
    const sound = asset({ folderId: "legacy" });
    const now = Date.parse("2026-10-26T12:00:00.000Z");
    const state = {
      ...DEFAULT_LIBRARY_ORGANIZATION,
      origin: "stock",
      date: "7",
    };
    expect(libraryOrganizationMatches(sound, state, now, folders)).toBe(true);
    expect(
      libraryOrganizationMatches(
        sound,
        { ...state, folder: "own" },
        now,
        folders
      )
    ).toBe(false);
    expect(
      libraryOrganizationMatches(
        asset({ folderId: "legacy", createdAt: "2026-09-01T12:00:00.000Z" }),
        state,
        now,
        folders
      )
    ).toBe(false);
    expect(
      libraryOrganizationMatches(
        sound,
        { ...state, origin: "uploaded" },
        now,
        folders
      )
    ).toBe(false);
  });
});
