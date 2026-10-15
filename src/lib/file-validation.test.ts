import { describe, expect, it } from "vitest";
import { createInstance } from "i18next";
import { validateFileSelection } from "./file-validation";

const file = (name: string, type: string, size = 10) => ({ name, type, size });

describe("file selection validation", () => {
  it("uses the selected interface translator for errors while preserving source filenames", async () => {
    const instance = createInstance();
    await instance.init({
      lng: "fr",
      defaultNS: "ui",
      keySeparator: false,
      nsSeparator: false,
      resources: {
        fr: {
          ui: {
            "a video file": "un fichier vidéo",
            "“{{name}}” is not supported here. Choose {{kind}}.":
              "« {{name}} » n'est pas pris en charge ici. Choisissez {{kind}}.",
          },
        },
      },
      interpolation: { escapeValue: false },
    });
    const source = file("My English source.pdf", "application/pdf");
    const result = validateFileSelection([source], {
      purpose: "video",
      language: "it",
      text: (key, values) => instance.t(key, values),
    });
    expect(result).toEqual({
      files: [],
      error:
        "« My English source.pdf » n'est pas pris en charge ici. Choisissez un fichier vidéo.",
    });
    expect(source.name).toBe("My English source.pdf");
  });
  it("accepts the same valid media whether selected or dropped", () => {
    const files = [file("clip.mp4", "video/mp4")];
    expect(validateFileSelection(files, { purpose: "video" })).toEqual({
      files,
      error: null,
    });
    expect(validateFileSelection(files, { purpose: "media" })).toEqual({
      files,
      error: null,
    });
  });

  it("rejects mixed drops atomically instead of silently ignoring a file", () => {
    const result = validateFileSelection(
      [file("clip.mp4", "video/mp4"), file("notes.pdf", "application/pdf")],
      { purpose: "media", multiple: true }
    );
    expect(result.files).toEqual([]);
    expect(result.error).toContain("notes.pdf");
  });

  it("accepts large media and rejects empty, active-markup, and multi-file single picks", () => {
    expect(
      validateFileSelection(
        [file("long-form.mov", "video/quicktime", 8 * 1024 * 1024 * 1024)],
        { purpose: "video" }
      ).error
    ).toBeNull();
    expect(
      validateFileSelection([file("empty.wav", "audio/wav", 0)], {
        purpose: "audio",
      }).error
    ).toContain("empty");
    expect(
      validateFileSelection([file("active.svg", "image/svg+xml")], {
        purpose: "media",
      }).error
    ).toContain("not supported");
    expect(
      validateFileSelection(
        [file("one.mp4", "video/mp4"), file("two.mp4", "video/mp4")],
        { purpose: "video" }
      ).error
    ).toContain("one file at a time");
  });

  it("accepts detector text formats and rejects unsupported documents", () => {
    expect(
      validateFileSelection([file("record.json", "application/json")], {
        purpose: "provenance",
      }).error
    ).toBeNull();
    expect(
      validateFileSelection([file("report.pdf", "application/pdf")], {
        purpose: "provenance",
      }).error
    ).toContain("not supported");
  });

  it("limits large batches and localizes public detector feedback", () => {
    const tooMany = Array.from({ length: 13 }, (_, index) =>
      file(`${index}.mp4`, "video/mp4")
    );
    expect(
      validateFileSelection(tooMany, { purpose: "media", multiple: true }).error
    ).toContain("12 files");
    expect(
      validateFileSelection([file("report.pdf", "application/pdf")], {
        language: "it",
        purpose: "provenance",
      }).error
    ).toContain("non è supportato");
  });
});
