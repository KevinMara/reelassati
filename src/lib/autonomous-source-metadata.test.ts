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
  it("measures visible overlay footage even when its sound is muted, excluding non-picture and transition clips", async () => {
    const ids = [
      "overlay",
      "hidden",
      "transition",
      "sound",
      "captions",
      "graphic",
    ];
    const assets = ids.map(id => ({ ...video, id }));
    const resolve = vi.fn(async (asset: Asset) => ({
      ...asset,
      width: 1920,
      height: 1080,
    }));
    const measured = await resolveAutonomousSourceMetadata(
      {
        ...project,
        clips: [
          { assetId: "overlay", track: "overlay", muted: true, volume: 0 },
          { assetId: "hidden", track: "overlay", hidden: true },
          { assetId: "transition", track: "video", transitionHandle: true },
          { assetId: "sound", track: "audio" },
          { assetId: "captions", track: "captions" },
          { assetId: "graphic", track: "overlay", graphic: { kind: "text" } },
        ],
      } as EditProject,
      assets,
      undefined,
      resolve
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(measured.map(asset => asset.id)).toEqual(["overlay"]);
  });
  it("respects effective picture solo without treating sound solo as picture hiding", async () => {
    const overlay = { ...video, id: "overlay" };
    const resolve = vi.fn(async (asset: Asset) => ({
      ...asset,
      width: 720,
      height: 1280,
    }));
    const edit = {
      ...project,
      clips: [
        { assetId: video.id, track: "video", lane: 1 },
        { assetId: overlay.id, track: "overlay", lane: 2 },
      ],
      trackSettings: [{ kind: "video", number: 2, soloPicture: true }],
    } as EditProject;
    const measured = await resolveAutonomousSourceMetadata(
      edit,
      [video, overlay],
      undefined,
      resolve
    );
    expect(measured.map(asset => asset.id)).toEqual(["overlay"]);
    resolve.mockClear();
    const soundSolo = await resolveAutonomousSourceMetadata(
      {
        ...edit,
        trackSettings: [{ kind: "video", number: 2, soloSound: true }],
      },
      [video, overlay],
      undefined,
      resolve
    );
    expect(soundSolo.map(asset => asset.id)).toEqual([video.id, overlay.id]);
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
