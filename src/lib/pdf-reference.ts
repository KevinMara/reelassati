import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

export const PDF_REFERENCE_LIMITS = {
  bytes: 10 * 1024 * 1024,
  pages: 200,
  characters: 16_000,
  timeoutMs: 45_000,
} as const;

export class PdfReferenceError extends Error {
  readonly code:
    | "file-size"
    | "page-count"
    | "page-range"
    | "text-limit"
    | "no-text"
    | "password"
    | "invalid"
    | "timeout"
    | "cancelled";
  readonly pageCount?: number;
  constructor(
    message: string,
    code: PdfReferenceError["code"],
    pageCount?: number
  ) {
    super(message);
    this.name = "PdfReferenceError";
    this.code = code;
    this.pageCount = pageCount;
  }
}

interface PdfReferenceOptions {
  /** One-based inclusive range. Omit to read all pages. */
  pages?: { start: number; end: number };
  signal?: AbortSignal;
  onProgress?: (page: number, totalPages: number) => void;
}

export interface PdfTextReference {
  name: string;
  text: string;
  pageCount: number;
  pagesRead: number;
  range: { start: number; end: number };
  emptyPages: number[];
  notice: string;
}

const TEXT_NOTICE =
  "Text extracted from PDF. Images, diagrams, handwriting, and visual layout have not been examined.";

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new PdfReferenceError(
      "PDF reading was cancelled. No reference was attached.",
      "cancelled"
    );
}

export function pdfPageRange(
  pageCount: number,
  pages?: PdfReferenceOptions["pages"]
) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
    throw new PdfReferenceError(
      "This PDF has no readable pages. Export a fresh PDF and try again.",
      "invalid"
    );
  }
  if (pageCount > PDF_REFERENCE_LIMITS.pages) {
    throw new PdfReferenceError(
      `This PDF has ${pageCount} pages. Export the relevant pages to a PDF with at most ${PDF_REFERENCE_LIMITS.pages} pages, then attach that file.`,
      "page-count",
      pageCount
    );
  }
  const range = pages ?? { start: 1, end: pageCount };
  if (
    !Number.isSafeInteger(range.start) ||
    !Number.isSafeInteger(range.end) ||
    range.start < 1 ||
    range.end < range.start ||
    range.end > pageCount
  ) {
    throw new PdfReferenceError(
      `Choose a page range between 1 and ${pageCount}.`,
      "page-range",
      pageCount
    );
  }
  return range;
}

/** Kept separate so PDF parsing can be verified with actual files in Node too. */
export async function extractPdfDocumentText(
  document: Pick<PDFDocumentProxy, "numPages" | "getPage">,
  name: string,
  options: PdfReferenceOptions = {}
): Promise<PdfTextReference> {
  const range = pdfPageRange(document.numPages, options.pages);
  const emptyPages: number[] = [];
  const header = `${TEXT_NOTICE}\nSource pages: ${range.start}–${range.end} of ${document.numPages}.\n`;
  let text = header;
  let hasText = false;
  const append = (part: string) => {
    if (text.length + part.length > PDF_REFERENCE_LIMITS.characters) {
      throw new PdfReferenceError(
        `This PDF contains more than ${PDF_REFERENCE_LIMITS.characters.toLocaleString("en-US")} characters of reference text. Export only the relevant pages or paste a shorter excerpt. No partial reference was attached.`,
        "text-limit",
        document.numPages
      );
    }
    text += part;
  };
  for (let pageNumber = range.start; pageNumber <= range.end; pageNumber++) {
    cancelled(options.signal);
    options.onProgress?.(pageNumber, document.numPages);
    const page = await document.getPage(pageNumber);
    let pageHasText = false;
    try {
      append(`\n[Page ${pageNumber}]\n`);
      // Process one page at a time, releasing it before requesting the next.
      const content = await page.getTextContent({
        includeMarkedContent: false,
      });
      for (const item of content.items) {
        cancelled(options.signal);
        if (!("str" in item)) continue;
        const value = item.str.replace(/\u0000/g, "");
        if (value.trim()) {
          pageHasText = true;
          hasText = true;
        }
        append(value);
        append(item.hasEOL ? "\n" : " ");
      }
    } finally {
      page.cleanup();
    }
    if (!pageHasText) {
      emptyPages.push(pageNumber);
      append("[No extractable text on this page.]\n");
    }
  }
  cancelled(options.signal);
  if (!hasText) {
    throw new PdfReferenceError(
      "No selectable text was found in this PDF. It may be a scan or image-only document. Export it with OCR, paste its text, or attach relevant pages as images. The PDF has not been visually analyzed.",
      "no-text",
      document.numPages
    );
  }
  return {
    name,
    text: text.trim(),
    pageCount: document.numPages,
    pagesRead: range.end - range.start + 1,
    range,
    emptyPages,
    notice: emptyPages.length
      ? `Text reference attached. ${emptyPages.length} page${emptyPages.length === 1 ? " has" : "s have"} no extractable text; images and diagrams were not read.`
      : "PDF text attached. Images, diagrams, and visual layout were not read.",
  };
}

/** Local parsing only. The original PDF is neither uploaded nor executed. */
export async function readPdfReference(
  file: File,
  options: PdfReferenceOptions = {}
): Promise<PdfTextReference> {
  cancelled(options.signal);
  if (file.size > PDF_REFERENCE_LIMITS.bytes) {
    throw new PdfReferenceError(
      "PDF references must be 10 MB or smaller. Export the relevant pages or compress the PDF, then attach it again.",
      "file-size"
    );
  }
  if (!file.size)
    throw new PdfReferenceError(
      "This PDF is empty. Choose a different file.",
      "invalid"
    );
  const signature = new TextDecoder("latin1").decode(
    await file.slice(0, 1024).arrayBuffer()
  );
  if (!signature.includes("%PDF-"))
    throw new PdfReferenceError(
      "This file is not a readable PDF. Export it as PDF or attach its text instead.",
      "invalid"
    );
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] =
    await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]);
  cancelled(options.signal);
  // Vite emits the pinned worker as an application asset; no CDN or user URL is used.
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    stopAtErrors: true,
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    enableXfa: false,
    cMapUrl: new URL("/vendor/pdfjs/cmaps/", location.origin).href,
    standardFontDataUrl: new URL(
      "/vendor/pdfjs/standard_fonts/",
      location.origin
    ).href,
  });
  let timeout = false;
  const abort = () => {
    void task.destroy().catch(() => undefined);
  };
  const timer = setTimeout(() => {
    timeout = true;
    abort();
  }, PDF_REFERENCE_LIMITS.timeoutMs);
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    cancelled(options.signal);
    const document = await task.promise;
    return await extractPdfDocumentText(document, file.name, options);
  } catch (cause) {
    cancelled(options.signal);
    if (timeout)
      throw new PdfReferenceError(
        "This PDF took too long to read. Export fewer pages or paste the relevant text, then try again.",
        "timeout"
      );
    if (cause instanceof PdfReferenceError) throw cause;
    if (cause instanceof Error && cause.name === "PasswordException") {
      throw new PdfReferenceError(
        "This PDF is password protected. Unlock it in your PDF app and attach an unlocked copy.",
        "password"
      );
    }
    throw new PdfReferenceError(
      "The PDF text could not be read reliably. Export a fresh PDF or paste the relevant text. No partial reference was attached.",
      "invalid"
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    await task.destroy().catch(() => undefined);
  }
}
