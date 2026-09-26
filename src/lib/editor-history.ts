import type { EditProject, EditRevision } from "@contracts/workspace";
import { contentDuration } from "./edit-timeline";

export function currentRevisionIndex(
  project: Pick<EditProject, "revisions" | "revisionIndex"> | undefined
): number {
  if (!project?.revisions.length) return -1;
  return Number.isInteger(project.revisionIndex)
    ? Math.max(
        0,
        Math.min(project.revisions.length - 1, project.revisionIndex!)
      )
    : project.revisions.length - 1;
}

/** Read the canonical project cursor inside each mutation, including sequential file uploads. */
export function appendEditorRevisions(
  project: Pick<EditProject, "revisions" | "revisionIndex">,
  additions: EditRevision[],
  initial: EditRevision
) {
  const branch = project.revisions.length
    ? project.revisions.slice(0, currentRevisionIndex(project) + 1)
    : [initial];
  const revisions = [...branch, ...additions]
    .filter(
      (revision, index, all) =>
        all.findIndex(r => r.id === revision.id) === index
    )
    .slice(-24);
  return { revisions, revisionIndex: revisions.length - 1 };
}

export function restoreEditorRevision(
  project: EditProject,
  index: number
): EditProject {
  const revision = project.revisions[index];
  if (!revision) return project;
  const duration = revision.duration ?? contentDuration(revision.clips);
  return {
    ...project,
    revisionIndex: index,
    clips: structuredClone(revision.clips),
    transcript: structuredClone(revision.transcript),
    transcriptProvenance: revision.transcriptProvenance,
    captionStyle: revision.captionStyle,
    captionAppearance: revision.captionAppearance,
    aspectRatio: revision.aspectRatio ?? project.aspectRatio,
    storyBeats: revision.storyBeats,
    duration,
    playhead: Math.min(project.playhead, duration),
    activeAssetId: revision.clips.some(c => c.assetId === project.activeAssetId)
      ? project.activeAssetId
      : revision.clips.find(c => c.assetId)?.assetId,
  };
}
