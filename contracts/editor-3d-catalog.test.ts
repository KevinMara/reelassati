import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { editor3dModels } from "./editor-3d-catalog";
import { validateStaticGlb } from "../src/lib/glb-validation";

describe("bundled CC0 3D models", () => {
  it.each(editor3dModels)(
    "validates the actual licensed $name binary before it reaches the renderer",
    model => {
      const path = fileURLToPath(
        new URL(`../public${model.path}`, import.meta.url)
      );
      const bytes = readFileSync(path);
      expect(bytes.byteLength).toBe(model.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        model.sha256
      );
      const result = validateStaticGlb(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        )
      );
      expect(result.triangles).toBeGreaterThan(100);
      expect(result.images).toBeGreaterThan(0);
      expect(model.license).toBe("CC0-1.0");
      expect(model.creator).toBe("Microsoft");
      expect(model.source).toContain(
        "KhronosGroup/glTF-Sample-Assets/tree/8f492390ddc7a2ae221a1369ef560589cf8c70fb/"
      );
      const preview = readFileSync(
        fileURLToPath(new URL(`../public${model.preview}`, import.meta.url))
      );
      expect(preview[0]).toBe(0xff);
      expect(preview[1]).toBe(0xd8);
      const license = readFileSync(
        path.replace(/\.glb$/, "-LICENSE.md"),
        "utf8"
      );
      expect(license).toContain('"CC0-1.0"');
    }
  );
});
