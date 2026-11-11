import { describe, expect, it, vi } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type {
  SharedMediaCatalogItem,
  SharedMediaCatalogManifest,
} from "@contracts/shared-media-catalog";
import {
  prepareSharedCatalogImport,
  runSharedCatalogImport,
  verifyCatalogFile,
  type CatalogImportApi,
  type CatalogImportProgress,
} from "./shared-catalog-import";

const signal = () => new AbortController().signal;
function fixture(index = 0) {
  const body = `measured audio ${index}`;
  const hash = bytesToHex(sha256(new TextEncoder().encode(body)));
  const item: SharedMediaCatalogItem = {
    id: `stock-${hash.slice(0, 24)}`,
    name: `Tone ${index}`,
    group: "Transitions",
    designId: "transition",
    variant: String(index),
    kind: "audio",
    tags: ["transition"],
    duration: 2,
    waveform: Array(64).fill(0.2),
    media: {
      file: `media/${hash}.wav`,
      sha256: hash,
      bytes: body.length,
      contentType: "audio/wav",
    },
    license: "platform-licensed",
    credits: 0,
  };
  return { item, file: localFile(body, item.media.file) };
}
function localFile(body: string, relative: string) {
  const file = new File([body], relative.split("/").at(-1)!);
  Object.defineProperty(file, "webkitRelativePath", {
    value: `prepared/${relative}`,
  });
  return file;
}
function selected(fixtures = [fixture()]) {
  const manifest: SharedMediaCatalogManifest = {
    schemaVersion: 1,
    items: fixtures.map(value => value.item),
  };
  return [
    localFile(JSON.stringify(manifest), "catalog.json"),
    ...fixtures.map(value => value.file),
  ];
}
function server() {
  const ready = new Set<string>(),
    pending = new Set<string>();
  const api: CatalogImportApi = {
    status: vi.fn(async (ids: string[]) => ({
      items: ids.map(id => ({
        id,
        status: ready.has(id)
          ? ("ready" as const)
          : pending.has(id)
            ? ("pending" as const)
            : ("missing" as const),
        missingObjects: ready.has(id) ? [] : ["media" as const],
      })),
    })),
    manifest: vi.fn(async manifest => {
      for (const item of manifest.items) pending.add(item.id);
    }),
    object: vi.fn(async id => {
      ready.add(id);
    }),
  };
  return { api, ready };
}

describe("foreground shared catalog import", () => {
  it("overlaps four uploads and drains them before reporting a failure", async () => {
    const entries = Array.from({ length: 8 }, (_, index) => fixture(index));
    const prepared = await prepareSharedCatalogImport(selected(entries));
    const { api } = server();
    const releases: Array<() => void> = [];
    let active = 0,
      peak = 0,
      started = 0;
    let notifyStarted!: () => void;
    const fourStarted = new Promise<void>(resolve => {
      notifyStarted = resolve;
    });
    api.object = vi.fn(async () => {
      const ordinal = started++;
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>(resolve => {
        releases.push(resolve);
        if (started === 4) notifyStarted();
      });
      active--;
      if (ordinal === 0) throw new Error("interrupted upload");
    });
    let settled = false;
    const outcome = runSharedCatalogImport(prepared, api, signal(), () => {})
      .then(
        () => null,
        error => error
      )
      .finally(() => {
        settled = true;
      });
    await fourStarted;
    expect(peak).toBe(4);
    releases[0]();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(active).toBe(3);
    releases.slice(1).forEach(release => release());
    expect(await outcome).toMatchObject({ message: "interrupted upload" });
    expect(active).toBe(0);
    expect(api.object).toHaveBeenCalledTimes(4);
  });
  it("reads only declared hashed files and rejects private manifest fields", async () => {
    const files = selected();
    const prepared = await prepareSharedCatalogImport([
      ...files,
      localFile("private receipt", "license.txt"),
    ]);
    expect(prepared.objectCount).toBe(1);
    expect([...prepared.files.keys()]).toEqual([fixture().item.media.file]);
    const raw = JSON.parse(await files[0].text());
    raw.items[0].supplier = "private";
    await expect(
      prepareSharedCatalogImport([
        localFile(JSON.stringify(raw), "catalog.json"),
        files[1],
      ])
    ).rejects.toMatchObject({ problem: "manifest" });
  });
  it("rejects missing, ambiguous, and wrong-size files before API activity", async () => {
    const files = selected();
    await expect(prepareSharedCatalogImport([files[0]])).rejects.toMatchObject({
      problem: "files",
    });
    await expect(
      prepareSharedCatalogImport([...files, files[1]])
    ).rejects.toMatchObject({ problem: "files" });
    await expect(
      prepareSharedCatalogImport([
        files[0],
        localFile("short", fixture().item.media.file),
      ])
    ).rejects.toMatchObject({ problem: "files" });
  });
  it("skips verified ready records and uploads only pending files", async () => {
    const entries = [fixture(1), fixture(2)],
      prepared = await prepareSharedCatalogImport(selected(entries));
    const { api, ready } = server();
    ready.add(entries[0].item.id);
    const receipts: CatalogImportProgress[] = [];
    const result = await runSharedCatalogImport(
      prepared,
      api,
      signal(),
      value => receipts.push(value)
    );
    expect(result).toMatchObject({
      stage: "complete",
      completedItems: 2,
      alreadyReady: 1,
      uploadedObjects: 1,
    });
    expect(api.manifest).toHaveBeenCalledWith({
      schemaVersion: 1,
      items: [entries[1].item],
    });
    expect(api.object).toHaveBeenCalledTimes(1);
    expect(
      receipts.some(
        value =>
          value.stage === "verifying" &&
          value.verifiedBytes === entries[1].file.size
      )
    ).toBe(true);
  });
  it("verifies same-size bytes locally before sending an object", async () => {
    const entry = fixture(),
      files = selected([entry]);
    const prepared = await prepareSharedCatalogImport([
      files[0],
      localFile("x".repeat(entry.file.size), entry.item.media.file),
    ]);
    const { api } = server();
    await expect(
      runSharedCatalogImport(prepared, api, signal(), () => {})
    ).rejects.toMatchObject({ problem: "digest" });
    expect(api.object).not.toHaveBeenCalled();
  });
  it("checks cancellation during chunked hashing", async () => {
    const active = new AbortController(),
      file = new File([new Uint8Array(2 * 1024 * 1024)], "large.wav");
    const read = vi.fn(() => active.abort());
    await expect(
      verifyCatalogFile(
        file,
        { ...fixture().item.media, bytes: file.size },
        active.signal,
        read
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(1024 * 1024);
  });
  it("resumes a stopped run from fresh server state without reuploading the completed item", async () => {
    const entries = [fixture(1), fixture(2)],
      prepared = await prepareSharedCatalogImport(selected(entries));
    const { api, ready } = server(),
      active = new AbortController();
    api.object = vi.fn(async id => {
      ready.add(id);
      active.abort();
    });
    await expect(
      runSharedCatalogImport(prepared, api, active.signal, () => {})
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(api.object).toHaveBeenCalledTimes(1);
    api.object = vi.fn(async id => {
      ready.add(id);
    });
    const result = await runSharedCatalogImport(
      prepared,
      api,
      signal(),
      () => {}
    );
    expect(result).toMatchObject({
      completedItems: 2,
      alreadyReady: 1,
      uploadedObjects: 1,
    });
    expect(api.object).toHaveBeenCalledWith(
      entries[1].item.id,
      "media",
      entries[1].file,
      entries[1].item.media
    );
  });
  it("does not retry a failed upload or claim completion without a ready receipt", async () => {
    const prepared = await prepareSharedCatalogImport(selected()),
      { api } = server();
    api.object = vi.fn(async () => {
      throw new Error("connection interrupted");
    });
    await expect(
      runSharedCatalogImport(prepared, api, signal(), () => {})
    ).rejects.toThrow("connection interrupted");
    expect(api.object).toHaveBeenCalledTimes(1);
    api.object = vi.fn(async () => {});
    await expect(
      runSharedCatalogImport(prepared, api, signal(), () => {})
    ).rejects.toMatchObject({ problem: "server" });
    expect(api.object).toHaveBeenCalledTimes(1);
  });
  it("keeps manifest and status batches bounded to fifty records", async () => {
    const prepared = await prepareSharedCatalogImport(
      selected(Array.from({ length: 51 }, (_, index) => fixture(index)))
    );
    const { api } = server();
    const result = await runSharedCatalogImport(
      prepared,
      api,
      signal(),
      () => {}
    );
    expect(result.completedItems).toBe(51);
    expect(
      vi
        .mocked(api.manifest)
        .mock.calls.map(([manifest]) => manifest.items.length)
    ).toEqual([50, 1]);
    expect(
      vi.mocked(api.status).mock.calls.every(([ids]) => ids.length <= 50)
    ).toBe(true);
  });
  it("rejects duplicate or contradictory server readiness records", async () => {
    const entry = fixture(),
      prepared = await prepareSharedCatalogImport(selected([entry])),
      { api } = server();
    api.status = vi.fn(async () => ({
      items: [
        {
          id: entry.item.id,
          status: "ready" as const,
          missingObjects: ["media" as const],
        },
      ],
    }));
    await expect(
      runSharedCatalogImport(prepared, api, signal(), () => {})
    ).rejects.toMatchObject({ problem: "server" });
    expect(api.manifest).not.toHaveBeenCalled();
  });
});
