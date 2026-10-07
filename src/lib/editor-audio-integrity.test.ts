import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { editorAudioCatalog } from "@contracts/editor-audio-catalog";

describe("selectable free audio", () => {
  it("contains complete, decodable audio matching each declared digest and duration", () => {
    for (const entry of editorAudioCatalog) {
      const path = `public/shared-assets/audio/${entry.file}`;
      const bytes = readFileSync(path);
      expect(bytes.byteLength, entry.id).toBeGreaterThan(0);
      expect(createHash("sha256").update(bytes).digest("hex"), entry.id).toBe(
        entry.sha256
      );
      const probe = JSON.parse(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            path,
          ],
          { encoding: "utf-8" }
        )
      );
      expect(
        Math.abs(Number(probe.format.duration) - entry.duration),
        entry.id
      ).toBeLessThan(0.06);
    }
  });
});
