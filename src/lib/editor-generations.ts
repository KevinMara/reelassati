import type {
  Asset,
  GenerationJob,
  WorkspaceDocument,
} from "@contracts/workspace";
import {
  generationKindLabel,
  type EditorGeneration,
  type EditorGenerationKind,
} from "@contracts/editor-generations";

export const LIBRARY_ASSET_MIME = "application/x-reelassati-asset-id";

export function nextEditorGeneration(
  workspace: WorkspaceDocument,
  projectId: string,
  kind: EditorGenerationKind,
  id: string,
  now: string
): EditorGeneration {
  let sequence =
    Math.max(
      0,
      ...(workspace.editorGenerations ?? [])
        .filter(g => g.kind === kind)
        .map(g => g.sequence)
    ) + 1;
  const occupied = new Set(
    workspace.assets.map(a => a.name.replace(/\.[^.]+$/, ""))
  );
  while (occupied.has(`${generationKindLabel[kind]} ${sequence}`)) sequence++;
  const name = `${generationKindLabel[kind]} ${sequence}`;
  return {
    id,
    projectId,
    kind,
    sequence,
    name,
    outputName: name,
    status: "submitting",
    createdAt: now,
    updatedAt: now,
  };
}

export function completeEditorGeneration(
  workspace: WorkspaceDocument,
  id: string,
  asset: Asset
): WorkspaceDocument {
  const record = workspace.editorGenerations?.find(g => g.id === id);
  if (record) {
    const expectedKind =
      record.kind === "video"
        ? "video"
        : record.kind === "image"
          ? "image"
          : "audio";
    if (
      asset.kind !== expectedKind ||
      asset.status !== "ready" ||
      (record.assetId && record.assetId !== asset.id) ||
      (asset.projectId && asset.projectId !== record.projectId)
    ) {
      throw new Error(
        "This output does not match the saved generation request."
      );
    }
  }
  const existing = workspace.assets.find(a => a.id === asset.id);
  const saved = {
    ...existing,
    ...asset,
    name:
      record?.status === "completed"
        ? (existing?.name ?? record.name)
        : (record?.name ?? existing?.name ?? asset.name),
    projectId: record?.projectId ?? existing?.projectId ?? asset.projectId,
    folderId: existing?.folderId ?? asset.folderId,
    favorite: existing?.favorite ?? asset.favorite,
    duration: asset.duration ?? existing?.duration,
    width: asset.width ?? existing?.width,
    height: asset.height ?? existing?.height,
  };
  return {
    ...workspace,
    assets: [saved, ...workspace.assets.filter(a => a.id !== asset.id)],
    editorGenerations: (workspace.editorGenerations ?? []).map(g =>
      g.id === id
        ? {
            ...g,
            status: "completed",
            assetId: asset.id,
            error: undefined,
            updatedAt: new Date().toISOString(),
          }
        : g
    ),
  };
}

/** Late network failures never invalidate an output already recovered and saved. */
export function failEditorGeneration(
  workspace: WorkspaceDocument,
  id: string,
  error: string
): WorkspaceDocument {
  return {
    ...workspace,
    editorGenerations: workspace.editorGenerations?.map(g =>
      g.id === id && g.status !== "completed"
        ? { ...g, status: "failed", error, updatedAt: new Date().toISOString() }
        : g
    ),
  };
}

export function applyVideoGenerationResult(
  workspace: WorkspaceDocument,
  id: string,
  result: { job: GenerationJob; asset?: Asset }
): WorkspaceDocument {
  const record = workspace.editorGenerations?.find(g => g.id === id);
  if (
    !record ||
    record.kind !== "video" ||
    result.job.type !== "video" ||
    result.job.id !== record.jobId ||
    (result.job.projectId && result.job.projectId !== record.projectId)
  )
    throw new Error(
      "This video result does not belong to the selected generation."
    );
  if (
    result.asset &&
    (result.asset.kind !== "video" ||
      result.asset.status !== "ready" ||
      result.job.resultAssetId !== result.asset.id)
  )
    throw new Error("The provider returned a mismatched video file.");
  const previousJob = workspace.jobs.find(j => j.id === result.job.id);
  const job = previousJob?.status === "completed" ? previousJob : result.job;
  const next = {
    ...workspace,
    jobs: [job, ...workspace.jobs.filter(j => j.id !== job.id)],
    editorGenerations: workspace.editorGenerations?.map(g =>
      g.id === id && g.status !== "completed"
        ? {
            ...g,
            status:
              job.status === "failed"
                ? ("failed" as const)
                : ("in_progress" as const),
            error: job.error,
            updatedAt: job.updatedAt,
          }
        : g
    ),
  };
  return result.asset ? completeEditorGeneration(next, id, result.asset) : next;
}

/** Merge a read-only recovery response into the latest local state, not its old request snapshot. */
export function recoverSavedEditorResults(
  workspace: WorkspaceDocument,
  source: Pick<WorkspaceDocument, "assets" | "jobs">,
  checkedId: string
): WorkspaceDocument {
  const currentRecord = workspace.editorGenerations?.find(
    g => g.id === checkedId
  );
  const remoteAssets = new Map(source.assets.map(a => [a.id, a]));
  const merged = {
    ...workspace,
    assets: [
      ...workspace.assets.map(a => {
        const remote = remoteAssets.get(a.id);
        return remote
          ? {
              ...remote,
              ...a,
              url: remote.url,
              status: remote.status,
              provenance: remote.provenance,
            }
          : a;
      }),
      ...source.assets.filter(
        a => !workspace.assets.some(existing => existing.id === a.id)
      ),
    ],
    jobs: [
      ...workspace.jobs.filter(
        j =>
          j.status === "completed" ||
          !source.jobs.some(remote => remote.id === j.id)
      ),
      ...source.jobs.filter(
        j =>
          !workspace.jobs.some(
            local => local.id === j.id && local.status === "completed"
          )
      ),
    ],
    editorGenerations: workspace.editorGenerations?.map(g =>
      g.id === checkedId && g.status === "failed"
        ? { ...g, status: "in_progress" as const }
        : g
    ),
  };
  const recovered = recoverEditorGenerations(merged);
  return {
    ...recovered,
    editorGenerations: recovered.editorGenerations?.map(g =>
      g.id === checkedId &&
      g.status !== "completed" &&
      currentRecord?.status === "failed"
        ? currentRecord
        : g
    ),
  };
}

/** Only recover an unambiguous result; no paid request is retried by this function. */
export function recoverEditorGenerations(
  workspace: WorkspaceDocument
): WorkspaceDocument {
  let next = workspace;
  for (const record of workspace.editorGenerations ?? []) {
    if (record.status === "completed" || record.status === "failed") continue;
    const job = record.jobId
      ? workspace.jobs.find(
          j =>
            j.id === record.jobId &&
            (!j.projectId || j.projectId === record.projectId)
        )
      : undefined;
    if (job?.status === "failed") {
      next = {
        ...next,
        editorGenerations: next.editorGenerations?.map(g =>
          g.id === record.id
            ? {
                ...g,
                status: "failed",
                error: job.error ?? "Generation failed.",
                updatedAt: job.updatedAt,
              }
            : g
        ),
      };
      continue;
    }
    const assetKind =
      record.kind === "video"
        ? "video"
        : record.kind === "image"
          ? "image"
          : "audio";
    const candidates = next.assets.filter(a => {
      if (a.status !== "ready" || a.kind !== assetKind) return false;
      if (a.projectId && a.projectId !== record.projectId) return false;
      if (record.assetId || job?.resultAssetId)
        return a.id === (record.assetId ?? job?.resultAssetId);
      return (
        a.provenance?.origin === "ai-generated" &&
        a.provenance.operation ===
          (record.kind === "image"
            ? "image-generation"
            : record.kind === "voice"
              ? "speech-synthesis"
              : record.kind === "video"
                ? "video-generation"
                : "audio-generation") &&
        a.name.replace(/\.[^.]+$/, "") === record.outputName &&
        Date.parse(a.createdAt) >= Date.parse(record.createdAt) &&
        !next.editorGenerations?.some(
          g => g.id !== record.id && g.assetId === a.id
        )
      );
    });
    if (candidates.length === 1)
      next = completeEditorGeneration(next, record.id, candidates[0]);
  }
  return next;
}
