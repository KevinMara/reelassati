import type {
  EditProject,
  EditRevision,
  WorkspaceDocument,
} from "@contracts/workspace";
import { appendEditorRevisions, currentRevisionIndex } from "./editor-history";

export const timelineFingerprint = (project: EditProject) =>
  JSON.stringify([
    project.clips,
    project.transcript,
    project.captionStyle,
    project.captionAppearance,
    project.trackSettings,
    project.editStyleTemplate,
    project.storyBeats,
    project.duration,
    project.aspectRatio,
    project.frameRate,
    // The server retains the latest 120 operations and rehydrates provenance.
    // Neither acknowledgement changes the requested edit itself.
    project.proposedChanges.slice(-120).map(operation => ({
      ...operation,
      provenance: undefined,
    })),
  ]);
const historyFingerprint = (
  project: Pick<EditProject, "revisions" | "revisionIndex">
) =>
  JSON.stringify([
    currentRevisionIndex(project),
    project.revisions.map(r => r.id),
  ]);
const revision = (
  project: EditProject,
  label: string,
  id = crypto.randomUUID()
): EditRevision => ({
  id,
  label,
  createdAt: new Date().toISOString(),
  clips: structuredClone(project.clips),
  transcript: structuredClone(project.transcript),
  duration: project.duration,
  captionStyle: project.captionStyle,
  captionAppearance: structuredClone(project.captionAppearance),
  aspectRatio: project.aspectRatio,
  frameRate: project.frameRate,
  trackSettings: structuredClone(project.trackSettings),
  transcriptProvenance: project.transcriptProvenance,
  storyBeats: structuredClone(project.storyBeats),
});

/** Publish only fully validated snapshots. One Undo restores the complete original.
 * Every saved step verifies the last timeline, so concurrent manual work wins. */
export async function publishAutonomousSteps(input: {
  original: EditProject;
  steps: Array<{ label: string; project: EditProject }>;
  update: (
    fn: (workspace: WorkspaceDocument) => WorkspaceDocument
  ) => Promise<unknown>;
  checkpoint: (workspace?: WorkspaceDocument) => void;
  onStep: (label: string, index: number) => void;
}) {
  let expected = timelineFingerprint(input.original);
  let expectedHistory = historyFingerprint(input.original);
  const before = revision(input.original, "Before auto-edit"),
    afterId = crypto.randomUUID();
  let started = false;
  for (const [index, step] of input.steps.entries()) {
    input.checkpoint();
    if (step.project.id !== input.original.id)
      throw new Error("The auto-edit step belongs to a different project.");
    let savedHistory = expectedHistory;
    await input.update(workspace => {
      input.checkpoint(workspace);
      const current = workspace.projects.find(p => p.id === input.original.id);
      if (
        !current ||
        timelineFingerprint(current) !== expected ||
        historyFingerprint(current) !== expectedHistory
      )
        throw new Error(
          "Your timeline changed during the edit. No further steps were applied. Use Undo to review the saved auto-edit steps."
        );
      const after = revision(step.project, "Auto-edit", afterId);
      const history = started
        ? {
            revisions: current.revisions.map(r =>
              r.id === afterId ? after : r
            ),
            revisionIndex: current.revisionIndex,
          }
        : appendEditorRevisions(current, [before, after], before);
      const next = {
        ...current,
        ...step.project,
        title: current.title,
        folderId: current.folderId,
        editorChat: current.editorChat,
        referenceStyleBrief: current.referenceStyleBrief,
        // Navigation and project metadata may change while the edit is being
        // prepared. Only the timeline and its prepared evidence belong to it.
        template: current.template,
        status: current.status,
        platform: current.platform,
        analyzerOptimization: current.analyzerOptimization,
        createdAt: current.createdAt,
        playhead: Math.min(current.playhead, step.project.duration),
        activeAssetId: step.project.clips.some(
          c => c.assetId === current.activeAssetId
        )
          ? current.activeAssetId
          : step.project.clips.find(c => c.assetId)?.assetId,
        ...history,
        updatedAt: new Date().toISOString(),
      };
      savedHistory = historyFingerprint(next);
      return {
        ...workspace,
        projects: workspace.projects.map(p => (p.id === next.id ? next : p)),
      };
    });
    expected = timelineFingerprint(step.project);
    expectedHistory = savedHistory;
    started = true;
    input.onStep(step.label, index);
  }
}
