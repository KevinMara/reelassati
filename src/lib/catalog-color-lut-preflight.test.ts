import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { cubeFixture } from "@contracts/test-fixtures/color-lut";
import { preflightEditColorLuts } from "./catalog-color-lut-preflight";

const operation = (source: string) => {
  const sha256 = createHash("sha256").update(source).digest("hex");
  return {
    type: "style" as const,
    parameters: {
      colorLut: {
        id: `stock-${sha256.slice(0, 24)}`,
        sha256,
        name: "Verified look",
        amount: 0.35,
      },
    },
  };
};
afterEach(() => vi.unstubAllGlobals());
describe("LUT execution preflight", () => {
  it("reads and verifies real CUBE bytes once for repeated use, while reset needs no fetch", async () => {
    const source = cubeFixture(2),
      op = operation(source);
    const fetcher = vi.fn(async () => new Response(source));
    vi.stubGlobal("fetch", fetcher);
    await preflightEditColorLuts(
      [op, op, { type: "style", parameters: { colorLut: null } }],
      new AbortController().signal
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects missing bytes and mismatched hashes before a caller can complete an edit", async () => {
    const op = operation(cubeFixture(3));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 503 }))
    );
    await expect(
      preflightEditColorLuts([op], new AbortController().signal)
    ).rejects.toThrow("could not load");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("corrupt"))
    );
    await expect(
      preflightEditColorLuts([op], new AbortController().signal)
    ).rejects.toThrow("does not match");
  });
  it("rejects malformed CUBE content even if its SHA matches", async () => {
    const source = "LUT_3D_SIZE 2\n0 0 0\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(source))
    );
    await expect(
      preflightEditColorLuts([operation(source)], new AbortController().signal)
    ).rejects.toThrow("incomplete");
  });
  it("honors cancellation before and during a read", async () => {
    const controller = new AbortController();
    const source = cubeFixture(4);
    const fetcher = vi.fn(async () => {
      controller.abort();
      return new Response(source);
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(
      preflightEditColorLuts([operation(source)], controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    fetcher.mockClear();
    await expect(
      preflightEditColorLuts([operation(source)], controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
