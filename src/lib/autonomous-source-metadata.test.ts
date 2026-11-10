import { describe, expect, it, vi } from "vitest";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  mergeAutonomousSourceMetadata,
  resolveAutonomousSourceMetadata,
} from "./autonomous-source-metadata";

const video = {
  id: "source",
  kind: "video",
  size: 100,
  contentType: "video/mp4",
  duration: 28.350708,
  name: "Original",
  url: "/source",
} as Asset;
const project = {
  clips: [{ assetId: video.id, track: "video" }],
} as EditProject;

describe("automatic edit source geometry", () => {
  it("recovers a duration-only legacy record before planning without probing unrelated library media", async () => {
    const resolve = vi.fn(async (asset: Asset) => ({
      ...asset,
      width: 720,
      height: 1280,
    }));
    const measured = await resolveAutonomousSourceMetadata(
      project,
      [
        video,
        { ...video, id: "unrelated" },
        { ...video, id: "sound", kind: "audio" },
      ],
      undefined,
      resolve
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(measured).toEqual([{ ...video, width: 720, height: 1280 }]);
    expect(video.width).toBeUndefined();
  });
  it("persists geometry without overwriting a concurrent rename, folder or renewed URL", () => {
    const current = {
      ...video,
      name: "Renamed",
      folderId: "folder",
      url: "/renewed",
    };
    expect(
      mergeAutonomousSourceMetadata(
        [current],
        [{ ...video, width: 720, height: 1280 }]
      )
    ).toEqual([{ ...current, width: 720, height: 1280 }]);
  });
  it("never recreates a removed source or writes dimensions to replaced bytes", () => {
    expect(() => mergeAutonomousSourceMetadata([], [video])).toThrow(
      "source changed"
    );
    expect(() =>
      mergeAutonomousSourceMetadata([{ ...video, size: 200 }], [video])
    ).toThrow("source changed");
  });
  it("does not save an aborted metadata response", async () => {
    const abort = new AbortController();
    const resolve = vi.fn(async (asset: Asset) => {
      abort.abort();
      return { ...asset, width: 720, height: 1280 };
    });
    await expect(
      resolveAutonomousSourceMetadata(project, [video], abort.signal, resolve)
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("propagates unreadable geometry before invoking any plan", async () => {
    const resolve = vi.fn(async () => {
      throw new Error("unreadable geometry");
    });
    await expect(
      resolveAutonomousSourceMetadata(project, [video], undefined, resolve)
    ).rejects.toThrow("unreadable geometry");
  });
});
