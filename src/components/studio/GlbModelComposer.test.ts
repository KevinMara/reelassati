import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlbModelComposer } from "./GlbModelComposer";

describe("GLB model composer", () => {
  it("describes a real static import with explicit format limits before saving", () => {
    let saves = 0;
    const html = renderToStaticMarkup(
      createElement(GlbModelComposer, {
        onSave: async () => {
          saves++;
        },
      })
    );
    expect(html).toContain(".glb, up to 25 MB");
    expect(html).toContain("transparent image for your timeline");
    expect(html).toContain("animated, skinned or compressed");
    expect(html).toContain("1024 × 1024");
    expect(html).toContain("Free 3D models");
    expect(html).toContain("Avocado");
    expect(html).toContain("Water bottle");
    expect(html).toContain("Microsoft · CC0");
    expect(html).toContain("/shared-assets/models/khronos/Avocado.jpg");
    expect(html).toContain("/shared-assets/models/khronos/WaterBottle.jpg");
    expect(html).not.toContain("Save pose to Library");
    expect(saves).toBe(0);
  });
  it("disables the file control during an owner upload", () => {
    const html = renderToStaticMarkup(
      createElement(GlbModelComposer, {
        disabled: true,
        onSave: async () => undefined,
      })
    );
    expect(html).toMatch(/type="file"[^>]+disabled=""/);
    expect(html).toMatch(
      /<button[^>]+disabled=""[^>]+aria-label="Load model · Avocado"/
    );
    expect(html).toMatch(
      /<button[^>]+disabled=""[^>]+aria-label="Load model · Water bottle"/
    );
  });
});
