import type {
  Asset,
  EditOperation,
  EditProject,
  TimelineClip,
} from "@contracts/workspace";
import { applyEditOperation } from "./edit-timeline";
import { assertSupportingMedia } from "@contracts/supporting-media";
import { auditAutomatedEdit } from "./editor-production";
const captionKey = (text: string) =>
  (
    text
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .match(/[\p{L}\p{M}]+|\p{N}+(?:[.,]\p{N}+)*/gu) ?? []
  ).join("\u001f");

const overlaps = (clip: TimelineClip, operation: EditOperation) =>
  clip.start < operation.end && clip.start + clip.duration > operation.start;

/** Validate the entire generation allowance before submitting the first asset. */
export function assertAutonomousMediaBudget(
  operations: EditOperation[],
  limits: { images: number; videos: number }
) {
  let images = 0,
    videos = 0;
  for (const op of operations) {
    if (op.type !== "broll" || op.parameters?.assetId || !op.parameters?.prompt)
      continue;
    if (op.parameters.mediaKind === "video") videos++;
    else if (op.parameters.mediaKind === "image") images++;
    else
      throw new Error(`${op.label}: choose an image or video generation type.`);
  }
  if (images > limits.images || videos > limits.videos)
    throw new Error(
      "The edit plan exceeds the approved supporting-media allowance. No media generation was started."
    );
}

/** Exercise the complete draft before buying optional media. Placeholders model
 * the exact five-second video allowance; they are never saved or rendered. */
export function preflightAutonomousPlan(
  project: EditProject,
  operations: EditOperation[],
  assets: Asset[],
  checkpoint: () => void = () => undefined
) {
  const placeholders: Asset[] = [];
  const reserved = new Set(assets.map(asset => asset.id));
  const resolved = operations.map(operation => {
    if (
      operation.type !== "broll" ||
      operation.parameters?.assetId ||
      !operation.parameters?.prompt
    )
      return operation;
    if (!["image", "video"].includes(operation.parameters.mediaKind ?? ""))
      throw new Error(
        `${operation.label}: choose an image or video generation type.`
      );
    let id = `preflight-${operation.id}`;
    while (reserved.has(id)) id += "-placeholder";
    reserved.add(id);
    const kind = operation.parameters.mediaKind as "image" | "video";
    placeholders.push({
      id,
      name: operation.label,
      kind,
      duration: kind === "video" ? 5 : undefined,
      status: "ready",
      contentType: kind === "video" ? "video/mp4" : "image/png",
      size: 0,
      url: "",
      createdAt: "",
    });
    return {
      ...operation,
      parameters: { ...operation.parameters, assetId: id },
    };
  });
  const allAssets = [...assets, ...placeholders];
  const draft = executeAutonomousPlan(project, resolved, allAssets, checkpoint);
  const problems = auditAutomatedEdit(project, draft, allAssets);
  if (problems.length)
    throw new Error(
      `The edit plan needs correction: ${problems.slice(0, 3).join("; ")}. No supporting media was generated.`
    );
}

/** Execute one proposal against its original timeline clock. Local operations
 * can split a source into several pieces: subsequent local operations must find
 * those pieces, rather than silently address only the old ID's surviving tail.
 * Any failed operation rejects the draft; callers publish only the full result. */
export function executeAutonomousPlan(
  project: EditProject,
  operations: EditOperation[],
  assets: Asset[],
  checkpoint: () => void = () => undefined
): EditProject {
  let working = structuredClone(project);
  const roots = new Map(project.clips.map(clip => [clip.id, clip.id]));
  const seen = new Set<string>();
  for (const operation of [...operations].sort((a, b) => b.start - a.start)) {
    checkpoint();
    if (seen.has(operation.id))
      throw new Error("The edit plan repeats an operation.");
    seen.add(operation.id);
    const base = project.clips.filter(c =>
      operation.targetClipIds.includes(c.id)
    );
    if (base.some(c => c.locked))
      throw new Error(`${operation.label}: a requested clip is locked.`);
    let execution = operation;
    if (["style", "audio", "split", "delete"].includes(operation.type)) {
      const targetClipIds = working.clips
        .filter(
          c =>
            operation.targetClipIds.includes(roots.get(c.id) ?? c.id) &&
            (operation.type === "delete"
              ? true
              : operation.type === "split"
                ? operation.start > c.start &&
                  operation.start < c.start + c.duration
                : overlaps(c, operation))
        )
        .map(c => c.id);
      if (!targetClipIds.length)
        throw new Error(
          `${operation.label}: its source interval is no longer available.`
        );
      execution = { ...operation, targetClipIds };
    }
    if (operation.type === "caption") {
      const words = captionKey(operation.parameters?.text ?? "");
      if (!words)
        throw new Error(`${operation.label}: caption words are missing.`);
      // Preparation already installs real captions. A planner repeating them is
      // not permission to put a second caption layer over the same speech.
      if (
        working.transcript.some(
          s =>
            s.start <= operation.start + 0.001 &&
            s.end >= operation.end - 0.001 &&
            captionKey(s.text) === words
        )
      ) {
        working.proposedChanges = working.proposedChanges.map(op =>
          op.id === operation.id
            ? {
                ...op,
                status: "accepted",
                reviewedAt: new Date().toISOString(),
              }
            : op
        );
        continue;
      }
      if (
        working.transcript.some(
          s => s.start < operation.end && s.end > operation.start
        )
      )
        throw new Error(
          `${operation.label}: this would overlap existing captions.`
        );
    }
    if (operation.type === "broll") {
      const asset = assets.find(a => a.id === operation.parameters?.assetId);
      try {
        assertSupportingMedia(
          asset,
          operation.parameters?.sourceIn ?? 0,
          operation.end - operation.start
        );
      } catch (error) {
        throw new Error(`${operation.label}: ${(error as Error).message}`);
      }
    }
    const before = working;
    try {
      working = applyEditOperation(working, execution);
    } catch (error) {
      throw new Error(
        `${operation.label}: ${error instanceof Error ? error.message : "the operation could not be applied."}`
      );
    }
    // Only IDs actually created by this operation can inherit a source root.
    // Never infer membership by matching unrelated pre-existing clip names.
    const priorIds = new Set(before.clips.map(c => c.id));
    const splitParents = [...before.clips].sort(
      (a, b) => b.id.length - a.id.length
    );
    for (const clip of working.clips) {
      if (priorIds.has(clip.id)) continue;
      const parent = splitParents.find(
        c => clip.id.startsWith(`${c.id}-`) && c.assetId === clip.assetId
      );
      if (parent) roots.set(clip.id, roots.get(parent.id) ?? parent.id);
    }
    // A structural decision referring to an original source after it moved or
    // split needs a fresh decision, not a best-effort change to the wrong piece.
    if (
      ["trim", "move", "pacing"].includes(operation.type) &&
      base.some(
        c =>
          before.clips.filter(piece => roots.get(piece.id) === c.id).length > 1
      )
    )
      throw new Error(
        `${operation.label}: split source pieces need explicit structural targets.`
      );
  }
  checkpoint();
  return working;
}
