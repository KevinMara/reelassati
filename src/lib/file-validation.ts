export type FilePurpose = "media" | "video" | "audio" | "provenance";

interface FileLike {
  name: string;
  size: number;
  type: string;
}

interface FileSelectionOptions {
  language?: "en" | "it";
  text?: (source: string, values?: Record<string, string | number>) => string;
  maxFiles?: number;
  multiple?: boolean;
  purpose: FilePurpose;
}

export const FILE_SELECTION_UI_COPY = {
  video: "a video file",
  audio: "an audio file",
  provenance: "an image, video, audio, JSON, Markdown, or text file",
  media: "a video, audio, or image file",
  choose: "Choose {{kind}}.",
  single: "Choose one file at a time for this section.",
  limit: "Upload up to {{count}} files at a time.",
  empty: "“{{name}}” is empty.",
  unsupported: "“{{name}}” is not supported here. Choose {{kind}}.",
};

const ITALIAN_FILE_SELECTION_COPY: Record<string, string> = {
  [FILE_SELECTION_UI_COPY.choose]: "Scegli {{kind}}.",
  [FILE_SELECTION_UI_COPY.single]:
    "Scegli un solo file alla volta per questa sezione.",
  [FILE_SELECTION_UI_COPY.limit]: "Carica fino a {{count}} file alla volta.",
  [FILE_SELECTION_UI_COPY.empty]: "“{{name}}” è vuoto.",
  [FILE_SELECTION_UI_COPY.unsupported]:
    "“{{name}}” non è supportato qui. Scegli {{kind}}.",
};

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
    text,
  }: FileSelectionOptions
): FileSelectionResult<T> {
  const ui =
    text ??
    ((source: string, values: Record<string, string | number> = {}) => {
      const copy =
        language === "it"
          ? ITALIAN_FILE_SELECTION_COPY[source] || source
          : source;
      return copy.replace(/\{\{(\w+)\}\}/g, (token, key) =>
        values[key] === undefined ? token : String(values[key])
      );
    });
  const kind = text
    ? text(FILE_SELECTION_UI_COPY[purpose])
    : expectedFileLabel(purpose, language);
  const files = Array.from(candidates);
  if (files.length === 0) {
    return {
      files: [],
      error: ui(FILE_SELECTION_UI_COPY.choose, { kind }),
    };
  }
  if (!multiple && files.length > 1) {
    return {
      files: [],
      error: ui(FILE_SELECTION_UI_COPY.single),
    };
  }
  if (multiple && files.length > maxFiles) {
    return {
      files: [],
      error: ui(FILE_SELECTION_UI_COPY.limit, { count: maxFiles }),
    };
  }

  const empty = files.find(file => file.size <= 0);
  if (empty) {
    return {
      files: [],
      error: ui(FILE_SELECTION_UI_COPY.empty, { name: empty.name }),
    };
  }

  const unsupported = files.find(file => !acceptsPurpose(file, purpose));
  if (unsupported) {
    return {
      files: [],
      error: ui(FILE_SELECTION_UI_COPY.unsupported, {
        name: unsupported.name,
        kind,
      }),
    };
  }

  return { files, error: null };
}
