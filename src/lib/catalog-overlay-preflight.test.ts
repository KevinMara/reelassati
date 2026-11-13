import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { normalizeVisual } from "@contracts/clip-visual";
import {
  preflightCatalogOverlays,
  catalogOverlayDraftBinding,
  type OverlayPixelEngine,
} from "./catalog-overlay-preflight";

const rgba = (color: number[], hole = false) =>
  Uint8Array.from({ length: 16 * 16 * 4 }, (_, i) => {
    const pixel = Math.floor(i / 4),
      x = pixel % 16,
      y = Math.floor(pixel / 16);
    return i % 4 === 3 && hole && x >= 3 && x < 13 && y >= 3 && y < 13
      ? 0
      : color[i % 4];
  });
const png = (pixels: Uint8Array) =>
  new Uint8Array(
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-threads",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        "16x16",
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-c:v",
        "png",
        "-f",
        "image2pipe",
        "pipe:1",
      ],
      { input: pixels, timeout: 15000 }
    )
  );

const video = (frames: Uint8Array[]) =>
  new Uint8Array(
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-threads",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        "16x16",
        "-r",
        "30",
        "-i",
        "pipe:0",
        "-frames:v",
        String(frames.length),
        "-c:v",
        "ffv1",
        "-level",
        "3",
        "-pix_fmt",
        "bgra",
        "-f",
        "matroska",
        "pipe:1",
      ],
      { input: Buffer.concat(frames), timeout: 15000 }
    )
  );

function fixture(bytes: Uint8Array, mode = "normal") {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const source = {
    id: "source",
    kind: "video",
    name: "Source",
    duration: 1,
    width: 16,
    height: 16,
    status: "ready",
  } as Asset;
  const asset = {
    id: "overlay",
    name: "Fixed media",
    kind: "image",
    status: "ready",
    duration: 3,
    width: 16,
    height: 16,
    size: bytes.length,
    contentType: "image/png",
    createdAt: "test",
    url: "",
    catalog: {
      id: `stock-${hash.slice(0, 24)}`,
      name: "Fixed media",
      group: "Frames",
      tags: [],
      designId: "test",
      variant: "Original",
      kind: "image",
      duration: 3,
      width: 16,
      height: 16,
      blendMode: mode,
      license: "platform-licensed",
      credits: 0,
      media: {
        file: `media/${hash}.png`,
        bytes: bytes.length,
        sha256: hash,
        contentType: "image/png",
      },
    },
  } as Asset;
  const clip = {
    id: "insert",
    assetId: asset.id,
    label: "Overlay",
    start: 0.013,
    duration: 0.2,
    inPoint: 0,
    outPoint: 0.2,
    track: "video",
    lane: 2,
    locked: false,
    color: "#fff",
    fit: "contain",
    muted: true,
    visual: normalizeVisual({ blendMode: mode }),
  } as TimelineClip;
  const project = {
    id: "p",
    title: "Fixture",
    duration: 1,
    aspectRatio: "1:1",
    frameRate: 30,
    transcript: [],
    clips: [
      {
        id: "source-clip",
        assetId: "source",
        label: "Source",
        start: 0,
        duration: 1,
        inPoint: 0,
        outPoint: 1,
        track: "video",
        lane: 1,
        locked: false,
        color: "#000",
      },
      clip,
    ],
    sourceReviews: [
      {
        assetId: "source",
        reviewedAt: "2026-11-13",
        moments: [],
        summary: "Known source",
        visualProtection: {
          version: 1,
          sourceDuration: 1,
          coverage: "complete",
          reviewedRanges: [{ start: 0, end: 1 }],
          observedText: [],
          regions: [
            {
              id: "caption",
              kind: "text",
              start: 0,
              end: 1,
              rect: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
              confidence: 1,
            },
          ],
        },
      },
    ],
  } as unknown as EditProject;
  return {
    project,
    assets: [source, asset],
    operationClipIds: { insert: [clip.id] },
    signal: new AbortController().signal,
    loadAsset: async () => new Blob([new Uint8Array(bytes)]),
    clip,
    asset,
  };
}

function nativeEngine(): OverlayPixelEngine {
  const directory = mkdtempSync(join(tmpdir(), "reel-overlay-test-"));
  return {
    async mountAsset(name, blob) {
      const file = join(directory, `source-${name}`);
      writeFileSync(file, new Uint8Array(await blob.arrayBuffer()));
      return file;
    },
    async exec(args) {
      execFileSync("ffmpeg", args, {
        cwd: directory,
        timeout: 30000,
        stdio: "pipe",
      });
      return 0;
    },
    async ffprobe(args) {
      execFileSync("ffprobe", args, {
        cwd: directory,
        timeout: 30000,
        stdio: "pipe",
      });
      return 0;
    },
    async readFile(path, encoding) {
      const data = readFileSync(join(directory, path));
      return encoding ? data.toString("utf8") : new Uint8Array(data);
    },
    async writeFile(path, bytes) {
      writeFileSync(join(directory, path), bytes);
    },
    async deleteFile(path) {
      const file = join(directory, path);
      if (existsSync(file)) rmSync(file);
      return true;
    },
    dispose() {
      if (
        resolve(directory).startsWith(
          resolve(tmpdir()) + "/reel-overlay-test-"
        ) ||
        resolve(directory).startsWith(
          resolve(tmpdir()) + "\\reel-overlay-test-"
        )
      )
        rmSync(directory, { recursive: true, force: true });
    },
  };
}

describe("selected catalog pixel preflight with actual native renderer", () => {
  it("keeps actual transparent PNG holes and rejects opaque pixels at the same placement", async () => {
    for (const [hole, blocked] of [
      [true, false],
      [false, true],
    ] as const) {
      const data = fixture(png(rgba([255, 255, 255, 255], hole)));
      const result = await preflightCatalogOverlays({
        ...data,
        createEngine: async () => nativeEngine(),
      });
      expect(result.unverifiedOperationIds).toEqual([]);
      expect(result.blockedOperationIds).toEqual(blocked ? ["insert"] : []);
      expect(result.canvas).toEqual({ width: 720, height: 720, frameRate: 30 });
    }
  }, 60000);
  it("checks the actual transformed placement rather than rejecting a full media rectangle", async () => {
    const data = fixture(png(rgba([255, 255, 255, 255])));
    data.clip.visual = normalizeVisual({ scale: 0.2, x: -38, y: -38 });
    const result = await preflightCatalogOverlays({
      ...data,
      createEngine: async () => nativeEngine(),
    });
    expect(result.checkedOperationIds).toEqual(["insert"]);
    const key = result.draftBinding;
    data.clip.visual.x = 0;
    data.clip.visual.y = 0;
    expect(catalogOverlayDraftBinding(data)).not.toBe(key);
    expect(
      (
        await preflightCatalogOverlays({
          ...data,
          createEngine: async () => nativeEngine(),
        })
      ).blockedOperationIds
    ).toEqual(["insert"]);
  }, 60000);
  it("rejects changed immutable media, unknown layout and canceled work without claiming a pixel pass", async () => {
    const data = fixture(png(rgba([255, 255, 255, 255])));
    data.asset.catalog!.media.sha256 = "f".repeat(64);
    const bad = await preflightCatalogOverlays({
      ...data,
      createEngine: async () => nativeEngine(),
    });
    expect(bad.unverifiedOperationIds).toEqual(["insert"]);
    expect(bad.checkedOperationIds).toEqual([]);
    data.project.sourceReviews = [];
    const create = vi.fn(async () => nativeEngine());
    const unknown = await preflightCatalogOverlays({
      ...data,
      createEngine: create,
    });
    expect(unknown.findings[0].reason).toBe("unknown-source-layout");
    expect(create).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    await expect(
      preflightCatalogOverlays({
        ...data,
        signal: controller.signal,
        createEngine: create,
      })
    ).rejects.toBeDefined();
  });
  it("protects the visible incoming source handle before the main shot starts", async () => {
    const data = fixture(png(rgba([255, 255, 255, 255])));
    const source = data.project.clips[0];
    source.start = 0.3;
    source.duration = 0.7;
    data.project.clips.push({
      ...source,
      id: "incoming-handle",
      start: 0,
      duration: 0.3,
      transitionHandle: true,
      primaryFootage: false,
    });
    const checked = await preflightCatalogOverlays({
      ...data,
      createEngine: async () => nativeEngine(),
    });
    expect(checked.unverifiedOperationIds).toEqual([]);
    expect(checked.blockedOperationIds).toEqual(["insert"]);
    expect(checked.findings[0].sourceClipId).toBe("incoming-handle");
  });
  it("does not certify invalid source regions just because their reviewed range survives normalization", async () => {
    const data = fixture(png(rgba([255, 255, 255, 255])));
    data.project.sourceReviews![0].visualProtection!.regions[0].rect.width = -1;
    const create = vi.fn(async () => nativeEngine());
    const result = await preflightCatalogOverlays({
      ...data,
      createEngine: create,
    });
    expect(result.checkedOperationIds).toEqual([]);
    expect(result.unverifiedOperationIds).toEqual(["insert"]);
    expect(result.findings[0].reason).toBe("unknown-source-layout");
    expect(create).not.toHaveBeenCalled();
  });
  it("binds receipts to exact delivery geometry and reports bounded rendering gaps", async () => {
    const data = fixture(png(rgba([255, 255, 255, 255])));
    expect(
      catalogOverlayDraftBinding({ ...data, settings: { resolution: 1080 } })
    ).not.toBe(catalogOverlayDraftBinding(data));
    data.clip.duration = 61;
    data.project.duration = 62;
    const create = vi.fn(async () => nativeEngine());
    const result = await preflightCatalogOverlays({
      ...data,
      createEngine: create,
    });
    expect(result.checkedOperationIds).toEqual([]);
    expect(result.findings[0].reason).toBe("resource-limit");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("selected catalog pixel preflight in the shipped WASM renderer", () => {
  let core: any;
  let logs: string[];
  beforeAll(async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    const require = createRequire(import.meta.url),
      path = require.resolve("@ffmpeg/core");
    // The executable test core must be byte-identical to the deployed gzip payload.
    expect(
      createHash("sha256")
        .update(gunzipSync(readFileSync("public/vendor/render/core.bin")))
        .digest("hex")
    ).toBe(
      createHash("sha256")
        .update(readFileSync(join(dirname(path), "ffmpeg-core.wasm")))
        .digest("hex")
    );
    core = await require(path)({
      wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")),
    });
    core.setLogger(({ message }: { message: string }) => {
      logs?.push(message);
    });
  }, 60000);
  afterAll(() => vi.unstubAllGlobals());
  function wasmEngine(): OverlayPixelEngine {
    logs = [];
    const files = new Set<string>();
    return {
      async mountAsset(name, blob) {
        const path = `source-${name}`;
        core.FS.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
        files.add(path);
        return path;
      },
      async exec(args) {
        files.add(args.at(-1)!);
        core.exec(...args);
        const code = core.ret;
        core.reset();
        return code;
      },
      async ffprobe(args) {
        files.add(args.at(-1)!);
        core.ffprobe(...args);
        const code = core.ret;
        core.reset();
        return code;
      },
      async readFile(path, encoding) {
        const data = core.FS.readFile(path) as Uint8Array;
        return encoding ? new TextDecoder().decode(data) : new Uint8Array(data);
      },
      async writeFile(path, bytes) {
        core.FS.writeFile(path, bytes);
        files.add(path);
      },
      async deleteFile(path) {
        try {
          core.FS.unlink(path);
        } catch {}
        files.delete(path);
        return true;
      },
      dispose() {
        for (const path of files) {
          try {
            core.FS.unlink(path);
          } catch {}
        }
      },
    };
  }
  it.each([
    ["normal", [255, 255, 255, 255], true, false],
    ["normal", [255, 255, 255, 255], false, true],
    ["screen", [0, 0, 0, 255], false, false],
    ["multiply", [255, 255, 255, 255], false, false],
  ] as const)(
    "runs FFV1 RGBA and actual %s delivery pixels (hole %s)",
    async (mode, color, hole, blocked) => {
      const data = fixture(png(rgba([...color], hole)), mode);
      const result = await preflightCatalogOverlays({
        ...data,
        createEngine: async () => wasmEngine(),
      });
      expect(result.unverifiedOperationIds, logs.slice(-8).join("\n")).toEqual(
        []
      );
      expect(result.blockedOperationIds).toEqual(blocked ? ["insert"] : []);
    },
    60000
  );
  it("checks every delivery frame of a video, including a one-frame obstruction between neutral frames", async () => {
    const data = fixture(
      video(
        Array.from({ length: 6 }, (_, index) =>
          rgba(index === 4 ? [255, 255, 255, 255] : [0, 0, 0, 255])
        )
      ),
      "screen"
    );
    data.asset.kind = "video";
    data.asset.catalog!.kind = "video";
    const result = await preflightCatalogOverlays({
      ...data,
      createEngine: async () => wasmEngine(),
    });
    expect(result.unverifiedOperationIds, logs.slice(-8).join("\n")).toEqual(
      []
    );
    expect(result.blockedOperationIds).toEqual(["insert"]);
    expect(result.findings[0].time).toBeCloseTo(5 / 30, 5);
  }, 60000);
  it("preserves authored alpha and evaluates the combined obstruction of selected layers", async () => {
    const data = fixture(png(rgba([255, 255, 255, 77])));
    const single = await preflightCatalogOverlays({
      ...data,
      createEngine: async () => wasmEngine(),
    });
    expect(single.checkedOperationIds).toEqual(["insert"]);
    data.project.clips.push({ ...data.clip, id: "second", lane: 3 });
    const result = await preflightCatalogOverlays({
      ...data,
      operationClipIds: { insert: ["insert"], second: ["second"] },
      createEngine: async () => wasmEngine(),
    });
    expect(result.unverifiedOperationIds, logs.slice(-8).join("\n")).toEqual(
      []
    );
    expect(result.blockedOperationIds).toEqual(["insert", "second"]);
    expect(data.clip.visual?.opacity).toBe(1);
  }, 60000);
});
