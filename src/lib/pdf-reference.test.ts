import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  extractPdfDocumentText,
  PDF_REFERENCE_LIMITS,
  pdfPageRange,
  readPdfReference,
} from "./pdf-reference";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/pdf-reference/", import.meta.url)
);
const packageRoot = path.dirname(
  createRequire(import.meta.url).resolve("pdfjs-dist/package.json")
);

async function withDocument<T>(
  name: string,
  callback: (
    document: Awaited<ReturnType<typeof getDocument>["promise"]>
  ) => Promise<T>
) {
  const task = getDocument({
    data: new Uint8Array(await readFile(path.join(fixtureRoot, name))),
    stopAtErrors: true,
    cMapUrl: `${packageRoot}/cmaps/`,
    standardFontDataUrl: `${packageRoot}/standard_fonts/`,
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
  });
  try {
    return await callback(await task.promise);
  } finally {
    await task.destroy();
  }
}

describe("PDF chat references", () => {
  it("extracts actual PDF text with page boundaries and an explicit text-only description", async () => {
    const result = await withDocument("text.pdf", document =>
      extractPdfDocumentText(document, "Writing guide.pdf")
    );
    expect(result).toMatchObject({
      name: "Writing guide.pdf",
      pageCount: 2,
      pagesRead: 2,
      emptyPages: [],
    });
    expect(result.text).toContain("[Page 1]");
    expect(result.text).toContain("A clear promise opens the story.");
    expect(result.text).toContain("[Page 2]");
    expect(result.text).toContain("Proof makes the ending satisfying.");
    expect(result.text).toContain("visual layout have not been examined");
  });

  it("extracts only an explicitly selected range and identifies the original page count", async () => {
    const result = await withDocument("text.pdf", document =>
      extractPdfDocumentText(document, "Writing guide.pdf", {
        pages: { start: 2, end: 2 },
      })
    );
    expect(result).toMatchObject({
      pageCount: 2,
      pagesRead: 1,
      range: { start: 2, end: 2 },
    });
    expect(result.text).not.toContain("A clear promise");
    expect(result.text).toContain("Source pages: 2–2 of 2");
  });

  it("does not call an image-only PDF a readable text reference", async () => {
    await expect(
      withDocument("image-only.pdf", document =>
        extractPdfDocumentText(document, "Scan.pdf")
      )
    ).rejects.toMatchObject({ code: "no-text" });
  });

  it("rejects oversized text instead of silently attaching the beginning", async () => {
    await expect(
      withDocument("oversize-text.pdf", document =>
        extractPdfDocumentText(document, "Long.pdf")
      )
    ).rejects.toMatchObject({ code: "text-limit", pageCount: 4 });
  });

  it("checks the complete document page count before starting extraction", async () => {
    await expect(
      withDocument("many-pages.pdf", document =>
        extractPdfDocumentText(document, "Book.pdf")
      )
    ).rejects.toMatchObject({ code: "page-count", pageCount: 201 });
  });

  it("rejects an invalid page selection", () => {
    expect(() => pdfPageRange(3, { start: 2, end: 4 })).toThrow(
      "between 1 and 3"
    );
    expect(() => pdfPageRange(3, { start: 2.5, end: 3 })).toThrow(
      "between 1 and 3"
    );
  });

  it("enforces byte and signature limits before loading the PDF library", async () => {
    const tooLarge = new File(
      [new Uint8Array(PDF_REFERENCE_LIMITS.bytes + 1)],
      "Large.pdf",
      { type: "application/pdf" }
    );
    await expect(readPdfReference(tooLarge)).rejects.toMatchObject({
      code: "file-size",
    });
    await expect(
      readPdfReference(new File(["Not a PDF"], "Renamed.pdf"))
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("honors cancellation before reading an attachment", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      readPdfReference(new File(["%PDF-1.7"], "file.pdf"), {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ code: "cancelled" });
  });
});
