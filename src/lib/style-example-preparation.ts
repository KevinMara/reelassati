import {
  normalizeReferenceEditStyle,
  type EditStyleExample,
  type EditStyleTemplate,
} from "@contracts/edit-style-template";
import type { Asset, WorkspaceDocument } from "@contracts/workspace";

/** Validate the complete pending set before any paid review begins. */
export function pendingStyleExampleAssets(
  template: EditStyleTemplate | undefined,
  assets: readonly Asset[]
): Array<{ example: EditStyleExample; asset: Asset }> {
  return (template?.examples ?? [])
    .filter(
      example =>
        example.source === "reference" &&
        !example.profile &&
        example.feedback !== "exclude"
    )
    .map(example => {
      const asset = assets.find(asset => asset.id === example.assetId);
      if (!asset || asset.kind !== "video" || asset.status !== "ready")
        throw new Error(
          "A style example is unavailable. Remove it or restore its video in the Library."
        );
      if (!Number.isFinite(asset.duration) || asset.duration! <= 0)
        throw new Error(
          "A style example needs a measured duration. Upload its video again before running Reel."
        );
      return { example, asset };
    });
}

/** Checkpoint each purchased observation so a later failure/reload never buys it again. */
export function saveStyleExampleReview(
  workspace: WorkspaceDocument,
  projectId: string,
  expected: EditStyleTemplate,
  exampleId: string,
  observation: unknown
): WorkspaceDocument {
  const profile = normalizeReferenceEditStyle(observation);
  if (!profile)
    throw new Error(
      "A style example could not be reviewed. No style was inferred."
    );
  const project = workspace.projects.find(project => project.id === projectId);
  if (
    !project ||
    JSON.stringify(project.editStyleTemplate) !== JSON.stringify(expected)
  )
    throw new Error("The style or project changed. Choose it again.");
  const reviewed = expected.examples?.find(example => example.id === exampleId);
  if (!reviewed || reviewed.source !== "reference")
    throw new Error("The style or project changed. Choose it again.");
  const update = (template: EditStyleTemplate) => ({
    ...template,
    examples: template.examples?.map(example =>
      example.id === exampleId &&
      example.source === "reference" &&
      example.assetId === reviewed.assetId
        ? { ...example, profile: structuredClone(profile) }
        : example
    ),
  });
  return {
    ...workspace,
    projects: workspace.projects.map(item =>
      item.id === projectId
        ? { ...item, editStyleTemplate: update(expected) }
        : item
    ),
    editStyleTemplates: workspace.editStyleTemplates?.map(template =>
      template.id === expected.id ? update(template) : template
    ),
  };
}
