export type EditorGenerationKind =
  "video" | "image" | "voice" | "music" | "sfx";

/** Saved request metadata; paid requests are never replayed automatically. */
export interface EditorGeneration {
  id: string;
  projectId: string;
  kind: EditorGenerationKind;
  sequence: number;
  name: string;
  outputName: string;
  status: "submitting" | "in_progress" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  jobId?: string;
  assetId?: string;
  error?: string;
}

export const generationKindLabel: Record<EditorGenerationKind, string> = {
  video: "Video",
  image: "Image",
  voice: "Voiceover",
  music: "Music",
  sfx: "Sound effect",
};

export function normalizeEditorGenerations(value: unknown): EditorGeneration[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is EditorGeneration => {
      if (!row || typeof row !== "object") return false;
      return (
        typeof row.id === "string" &&
        typeof row.projectId === "string" &&
        Object.hasOwn(generationKindLabel, row.kind) &&
        ["submitting", "in_progress", "completed", "failed"].includes(
          row.status
        ) &&
        typeof row.name === "string" &&
        typeof row.outputName === "string" &&
        typeof row.createdAt === "string" &&
        Number.isFinite(Date.parse(row.createdAt)) &&
        typeof row.updatedAt === "string" &&
        Number.isFinite(Date.parse(row.updatedAt))
      );
    })
    .slice(-1000)
    .map(row => ({
      id: row.id.slice(0, 160),
      projectId: row.projectId.slice(0, 160),
      kind: row.kind,
      sequence:
        Number.isSafeInteger(row.sequence) && row.sequence > 0
          ? row.sequence
          : 1,
      name: row.name.slice(0, 240),
      outputName: row.outputName.slice(0, 240),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(typeof row.jobId === "string"
        ? { jobId: row.jobId.slice(0, 160) }
        : {}),
      ...(typeof row.assetId === "string"
        ? { assetId: row.assetId.slice(0, 160) }
        : {}),
      ...(typeof row.error === "string"
        ? { error: row.error.slice(0, 500) }
        : {}),
    }));
}
