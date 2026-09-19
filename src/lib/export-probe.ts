import { verifyExportMetadata } from "./export-verification";

type ExportProbeEngine = {
  ffprobe: (args: string[]) => Promise<number>;
  readFile: (path: string, encoding: "utf8") => Promise<string | Uint8Array>;
  deleteFile: (path: string) => Promise<boolean>;
};

let probeSequence = 0;

/** Read encoded metadata using the same core shipped to the browser. */
export async function probeExportMetadata(
  engine: ExportProbeEngine,
  expected: { width: number; height: number; duration: number }
) {
  // Never consume a previous probe's JSON after an interrupted/failed command.
  const path = `export-probe-${++probeSequence}.json`;
  try {
    const code = await engine.ffprobe([
      "-v",
      "error",
      "-show_error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      "output.mp4",
      "-o",
      path,
    ]);
    // @ffmpeg/core 0.12.10 leaves ret at its reset sentinel (-1) for both
    // successful and failed ffprobe calls. Require a fresh, error-free JSON
    // report and validate the actual streams; the renderer also fully decodes
    // every video/audio packet before making the download available.
    if (code !== 0 && code !== -1) throw new Error("Probe command failed");
    const report = await engine.readFile(path, "utf8");
    if (typeof report !== "string") throw new Error("Probe report is missing");
    const value: unknown = JSON.parse(report);
    if (!value || typeof value !== "object" || "error" in value)
      throw new Error("Probe reported an input error");
    return verifyExportMetadata(value, expected);
  } catch {
    throw new Error(
      "The exported video did not pass its duration and picture checks. Your project is saved; please retry export."
    );
  } finally {
    // The worker may already have been terminated by Cancel.
    await engine.deleteFile(path).catch(() => false);
  }
}
