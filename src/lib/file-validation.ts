import { MAX_UPLOAD_BYTES, UPLOAD_SIZE_LABEL } from "@contracts/uploads";

export type FilePurpose = "media" | "video" | "audio" | "provenance";

interface FileLike {
  name: string;
  size: number;
  type: string;
}

interface FileSelectionOptions {
  language?: "en" | "it";
  maxFiles?: number;
  multiple?: boolean;
  purpose: FilePurpose;
}

export type FileSelectionResult<T extends FileLike> =
  { files: T[]; error: null } | { files: []; error: string };

const PROVENANCE_MIME_TYPES = new Set([
  "application/json",
  "text/markdown",
  "text/plain",
]);

function expectedFileLabel(
  purpose: FilePurpose,
  language: "en" | "it"
): string {
  if (language === "it") {
    switch (purpose) {
      case "video":
        return "un file video";
      case "audio":
        return "un file audio";
      case "provenance":
        return "un file immagine, video, audio, JSON, Markdown o testo";
      case "media":
        return "un file video, audio o immagine";
    }
  }
  switch (purpose) {
    case "video":
      return "a video file";
    case "audio":
      return "an audio file";
    case "provenance":
      return "an image, video, audio, JSON, Markdown, or text file";
    case "media":
      return "a video, audio, or image file";
  }
}

function acceptsPurpose(file: FileLike, purpose: FilePurpose): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/svg+xml" || name.endsWith(".svg")) return false;
  if (purpose === "video") return type.startsWith("video/");
  if (purpose === "audio") return type.startsWith("audio/");
  if (purpose === "media") {
    return (
      type.startsWith("video/") ||
      type.startsWith("audio/") ||
      type.startsWith("image/")
    );
  }
  return (
    type.startsWith("video/") ||
    type.startsWith("audio/") ||
    type.startsWith("image/") ||
    PROVENANCE_MIME_TYPES.has(type) ||
    name.endsWith(".json") ||
    name.endsWith(".md") ||
    name.endsWith(".txt")
  );
}

export function validateFileSelection<T extends FileLike>(
  candidates: readonly T[],
  {
    language = "en",
    maxFiles = 12,
    multiple = false,
    purpose,
  }: FileSelectionOptions
): FileSelectionResult<T> {
  const files = Array.from(candidates);
  if (files.length === 0) {
    return {
      files: [],
      error:
        language === "it"
          ? `Scegli ${expectedFileLabel(purpose, language)}.`
          : `Choose ${expectedFileLabel(purpose, language)}.`,
    };
  }
  if (!multiple && files.length > 1) {
    return {
      files: [],
      error:
        language === "it"
          ? "Scegli un solo file alla volta per questa sezione."
          : "Choose one file at a time for this section.",
    };
  }
  if (multiple && files.length > maxFiles) {
    return {
      files: [],
      error:
        language === "it"
          ? `Carica fino a ${maxFiles} file alla volta.`
          : `Upload up to ${maxFiles} files at a time.`,
    };
  }

  const empty = files.find(file => file.size <= 0);
  if (empty) {
    return {
      files: [],
      error:
        language === "it"
          ? `“${empty.name}” è vuoto.`
          : `“${empty.name}” is empty.`,
    };
  }

  const oversized = files.find(file => file.size > MAX_UPLOAD_BYTES);
  if (oversized) {
    return {
      files: [],
      error:
        language === "it"
          ? `“${oversized.name}” supera il limite di caricamento di ${UPLOAD_SIZE_LABEL}.`
          : `“${oversized.name}” is larger than the ${UPLOAD_SIZE_LABEL} upload limit.`,
    };
  }

  const unsupported = files.find(file => !acceptsPurpose(file, purpose));
  if (unsupported) {
    return {
      files: [],
      error:
        language === "it"
          ? `“${unsupported.name}” non è supportato qui. Scegli ${expectedFileLabel(purpose, language)}.`
          : `“${unsupported.name}” is not supported here. Choose ${expectedFileLabel(purpose, language)}.`,
    };
  }

  return { files, error: null };
}
