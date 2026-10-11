import type { Asset } from "@contracts/workspace";

export type ExportDestination = "download" | "library";
export interface BrowserRenderResult {
  file: File;
  width: number;
  height: number;
  duration: number;
}

/** Download-only exports avoid storage. AI media retains server-finalized markings. */
export async function deliverBrowserExport(
  result: BrowserRenderResult,
  options: {
    destination: ExportDestination;
    requiresMarking: boolean;
    upload: () => Promise<Asset>;
    save: (asset: Asset) => Promise<void>;
    download: (asset: Asset) => Promise<Uint8Array>;
  }
): Promise<{ asset: Asset | null; file: File | null }> {
  if (options.destination === "download") {
    if (options.requiresMarking)
      throw new Error(
        "Save this export to Library to finalize its AI source marking."
      );
    return { asset: null, file: result.file };
  }
  const uploaded = await options.upload();
  if (uploaded.contentType !== result.file.type)
    throw new Error(
      "The saved video has a different format than the export. Please retry saving to Library."
    );
  const asset = {
    ...uploaded,
    duration: result.duration,
    width: result.width,
    height: result.height,
  };
  await options.save(asset);
  try {
    const bytes = await options.download(asset);
    return {
      asset,
      file: new File([new Uint8Array(bytes).buffer], result.file.name, {
        type: asset.contentType,
      }),
    };
  } catch {
    // AI downloads must use finalized bytes; the saved asset remains available in Library.
    return { asset, file: options.requiresMarking ? null : result.file };
  }
}
