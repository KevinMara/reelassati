import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { probeExportMetadata } from "./export-probe";

type WasmCore = {
  ret: number;
  exec: (...args: string[]) => void;
  ffprobe: (...args: string[]) => void;
  reset: () => void;
  setLogger: (
    logger: (data: { type: string; message: string }) => void
  ) => void;
  FS: {
    readFile: (
      path: string,
      options?: { encoding: "utf8" }
    ) => string | Uint8Array;
    writeFile: (path: string, bytes: Uint8Array) => void;
    unlink: (path: string) => void;
    readdir: (path: string) => string[];
  };
};

describe("the installed browser WASM export verifier", () => {
  let core: WasmCore;
  let validMp4: Uint8Array;
  let lastProbeCode: number;
  const expected = { width: 64, height: 64, duration: 0.5 };
  const engine = {
    async ffprobe(args: string[]) {
      core.ffprobe(...args);
      lastProbeCode = core.ret;
      core.reset();
      return lastProbeCode;
    },
    async readFile(path: string, encoding: "utf8") {
      return core.FS.readFile(path, { encoding });
    },
    async deleteFile(path: string) {
      core.FS.unlink(path);
      return true;
    },
  };

  beforeAll(async () => {
    // The exact browser core runs without a browser when given its WASM bytes.
    // Only the worker location used during boot needs an environment shim.
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    const require = createRequire(import.meta.url);
    const corePath = require.resolve("@ffmpeg/core");
    const createCore = require(corePath) as (options: {
      wasmBinary: Uint8Array;
    }) => Promise<WasmCore>;
    core = await createCore({
      wasmBinary: readFileSync(join(dirname(corePath), "ffmpeg-core.wasm")),
    });
    core.setLogger(() => {});
    core.exec(
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=red:s=64x64:d=0.5:r=10",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "output.mp4"
    );
    expect(core.ret).toBe(0);
    core.reset();
    const bytes = core.FS.readFile("output.mp4");
    if (typeof bytes === "string") throw new Error("Expected encoded bytes");
    validMp4 = bytes.slice();
  }, 15000);

  beforeEach(() => {
    core.FS.writeFile("output.mp4", validMp4);
  });
  afterAll(() => vi.unstubAllGlobals());

  it("accepts a real valid probe despite its unset return code, and the MP4 fully decodes", async () => {
    await expect(probeExportMetadata(engine, expected)).resolves.toEqual(
      expected
    );
    expect(lastProbeCode).toBe(-1);
    core.exec(
      "-v",
      "error",
      "-xerror",
      "-i",
      "output.mp4",
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-f",
      "null",
      "-"
    );
    expect(core.ret).toBe(0);
    core.reset();
    expect(
      core.FS.readdir("/").filter(name => name.startsWith("export-probe-"))
    ).toEqual([]);
  });

  it("rejects corrupt media even though the same core also returns -1 on failure", async () => {
    core.FS.writeFile("output.mp4", new Uint8Array([1, 2, 3]));
    await expect(probeExportMetadata(engine, expected)).rejects.toThrow(
      "did not pass"
    );
    expect(lastProbeCode).toBe(-1);
  });

  it("still rejects incorrect encoded dimensions and duration", async () => {
    await expect(
      probeExportMetadata(engine, { ...expected, width: 128 })
    ).rejects.toThrow("did not pass");
    await expect(
      probeExportMetadata(engine, { ...expected, duration: 5 })
    ).rejects.toThrow("did not pass");
  });

  it("rejects explicit command errors rather than treating valid-looking data as success", async () => {
    const failedEngine = { ...engine, ffprobe: async () => 1 };
    await expect(probeExportMetadata(failedEngine, expected)).rejects.toThrow(
      "did not pass"
    );
  });

  it("does not accept an older report when a subsequent probe cannot write its output", async () => {
    await probeExportMetadata(engine, expected);
    const interruptedEngine = { ...engine, ffprobe: async () => -1 };
    await expect(
      probeExportMetadata(interruptedEngine, expected)
    ).rejects.toThrow("did not pass");
  });
});
