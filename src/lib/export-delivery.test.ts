import { describe, expect, it, vi } from "vitest";
import type { Asset } from "@contracts/workspace";
import { deliverBrowserExport } from "./export-delivery";

const result = {
  file: new File(["raw render"], "edit.mp4", { type: "video/mp4" }),
  width: 720,
  height: 1280,
  duration: 4,
};
function delivery() {
  return {
    destination: "library" as const,
    requiresMarking: false,
    upload: vi.fn(
      async () => ({ id: "export", contentType: "video/mp4" }) as Asset
    ),
    save: vi.fn(async () => undefined),
    download: vi.fn(async () => new TextEncoder().encode("finalized render")),
  };
}
describe("browser export delivery", () => {
  it("downloads original media without an upload, workspace save or second network transfer", async () => {
    const callbacks = delivery();
    const delivered = await deliverBrowserExport(result, {
      ...callbacks,
      destination: "download",
    });
    expect(delivered).toEqual({ file: result.file, asset: null });
    expect(callbacks.upload).not.toHaveBeenCalled();
    expect(callbacks.save).not.toHaveBeenCalled();
    expect(callbacks.download).not.toHaveBeenCalled();
  });
  it("cannot bypass AI source finalization with the local destination", async () => {
    const callbacks = delivery();
    await expect(
      deliverBrowserExport(result, {
        ...callbacks,
        destination: "download",
        requiresMarking: true,
      })
    ).rejects.toThrow("AI source marking");
    expect(callbacks.upload).not.toHaveBeenCalled();
  });
  it("uses the finalized bytes and verified dimensions after saving a marked asset", async () => {
    const callbacks = delivery();
    const delivered = await deliverBrowserExport(result, {
      ...callbacks,
      requiresMarking: true,
    });
    expect(callbacks.save).toHaveBeenCalledWith(
      expect.objectContaining({ width: 720, height: 1280, duration: 4 })
    );
    expect(await delivered.file!.text()).toBe("finalized render");
    expect(delivered.file!.name).toBe("edit.mp4");
  });
  it("keeps a saved AI asset available without releasing unmarked bytes when its download fails", async () => {
    const callbacks = delivery();
    callbacks.download.mockRejectedValue(new Error("offline"));
    const delivered = await deliverBrowserExport(result, {
      ...callbacks,
      requiresMarking: true,
    });
    expect(delivered.asset?.id).toBe("export");
    expect(delivered.file).toBeNull();
  });
  it("propagates save failure for retry and rejects a mismatched container before committing", async () => {
    const callbacks = delivery();
    callbacks.save.mockRejectedValueOnce(new Error("quota"));
    await expect(deliverBrowserExport(result, callbacks)).rejects.toThrow(
      "quota"
    );
    expect(callbacks.download).not.toHaveBeenCalled();
    callbacks.upload.mockResolvedValueOnce({
      id: "wrong",
      contentType: "video/webm",
    } as Asset);
    await expect(deliverBrowserExport(result, callbacks)).rejects.toThrow(
      "different format"
    );
    expect(callbacks.save).toHaveBeenCalledTimes(1);
  });
});
