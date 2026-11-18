import { describe, expect, it, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  copyFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { EDITOR_FONTS, editorFontMetrics } from "@contracts/editor-fonts";
import { getCaptionPreset, captionLineWidth } from "@contracts/editor-presets";
import {
  captionAssEvents,
  captionAssStyle,
  captionTextCss,
} from "./caption-rendering";
import { fetchEditorFont, loadEditorFont } from "./editor-fonts";

afterEach(() => vi.unstubAllGlobals());
const cue = { id: "c", start: 0, end: 1, text: "Video 2026 — voilà!" };
describe("bundled exact caption faces", () => {
  for (const face of EDITOR_FONTS)
    it(`renders ${face.id} with its actual font and saved metrics`, () => {
      const data = readFileSync(`public${face.url}`);
      expect(createHash("sha256").update(data).digest("hex")).toBe(face.sha256);
      const appearance = { fontId: face.id, size: 8, outline: 0, bold: false };
      const preset = getCaptionPreset("classic", appearance);
      expect(captionLineWidth("MMMM", preset)).toBeCloseTo(
        editorFontMetrics(face.id)!.advances.M * 32
      );
      expect(captionTextCss(preset).fontFamily).toContain(face.id);
      const dir = mkdtempSync(join(tmpdir(), "reel-font-"));
      try {
        copyFileSync(`public${face.url}`, join(dir, "face.ttf"));
        const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 640\nPlayResY: 360\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n${captionAssStyle("classic", 640, 360, appearance)}\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${captionAssEvents([cue], "classic", 1, appearance)}\n`;
        writeFileSync(join(dir, "caption.ass"), ass);
        const rendered = spawnSync(
          "ffmpeg",
          [
            "-hide_banner",
            "-f",
            "lavfi",
            "-i",
            "color=black:s=640x360:d=1",
            "-vf",
            "subtitles=caption.ass:fontsdir=.,format=rgb24",
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { cwd: dir, maxBuffer: 4_000_000, timeout: 15000, windowsHide: true }
        );
        expect(rendered.status, rendered.stderr.toString()).toBe(0);
        expect(rendered.stderr.toString()).toContain(face.postscript);
        expect(rendered.stderr.toString()).not.toContain("Glyph 0x");
        expect(rendered.stdout.length).toBe(640 * 360 * 3);
        expect(rendered.stdout.filter(v => v > 100).length).toBeGreaterThan(
          500
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  it("rejects unknown identifiers and allows returning to the default font", () => {
    expect(
      getCaptionPreset("classic", { fontId: "../../secret" }).fontId
    ).toBeUndefined();
    expect(
      getCaptionPreset("classic", { fontId: "default" }).fontId
    ).toBeUndefined();
  });
  it("detects a wrong HTTP-success font instead of rendering a fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
    );
    await expect(fetchEditorFont(EDITOR_FONTS[0].id)).rejects.toThrow(
      "did not match"
    );
  });
  it("can retry a failed download and verifies the successful bytes", async () => {
    const face = EDITOR_FONTS[0];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(readFileSync(`public${face.url}`)))
    );
    await expect(fetchEditorFont(face.id)).rejects.toThrow("could not load");
    await expect(fetchEditorFont(face.id)).resolves.toHaveLength(
      readFileSync(`public${face.url}`).length
    );
  });
  it("retries a rejected face load and registers the exact export baseline", async () => {
    const face = EDITOR_FONTS[0];
    const add = vi.fn();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("font decode failed"))
      .mockResolvedValueOnce({ family: `Reel-${face.id}` });
    const descriptors: FontFaceDescriptors[] = [];
    vi.stubGlobal("document", { fonts: { add } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(readFileSync(`public${face.url}`)))
    );
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(
          _family: string,
          _bytes: Uint8Array,
          descriptor: FontFaceDescriptors
        ) {
          descriptors.push(descriptor);
        }
        load = load;
      }
    );
    await expect(loadEditorFont(face.id)).rejects.toThrow("font decode failed");
    expect(add).not.toHaveBeenCalled();
    await expect(loadEditorFont(face.id)).resolves.toBeUndefined();
    expect(add).toHaveBeenCalledExactlyOnceWith({ family: `Reel-${face.id}` });
    const metrics = editorFontMetrics(face.id)!;
    expect(descriptors[1]).toEqual({
      ascentOverride: `${metrics.ascent * 100}%`,
      descentOverride: `${metrics.descent * 100}%`,
      lineGapOverride: "0%",
    });
    await loadEditorFont(face.id);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
