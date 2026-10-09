import type { EditOperation, EditProject, QualitySignal, TimelineClip } from "@contracts/workspace";
import { expandLinkedSelection } from "@contracts/clip-groups";
import { clipLaneKind } from "@contracts/timeline-layers";

const EPSILON = 0.000001;
function validSpan(start: number, end: number, duration: number) {
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= duration + EPSILON;
}
function sourceSpan(clip: TimelineClip) {
  const speed = clip.speed ?? 1;
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 4 || !Number.isFinite(clip.inPoint) || clip.inPoint < 0 || !Number.isFinite(clip.duration) || clip.duration <= 0 || !Number.isFinite(clip.start) || clip.start < 0 || Math.abs(clip.outPoint - clip.inPoint - clip.duration * speed) > 0.001)
    throw new Error("The analyzed source has an invalid timeline clock. Repair its trim before queueing analysis.");
  return { start: clip.inPoint, end: clip.inPoint + clip.duration * speed, speed };
}
function mapSpan(clip: TimelineClip, start: number, end: number) {
  const source = sourceSpan(clip);
  const from = Math.max(start, source.start), to = Math.min(end, source.end);
  if (to <= from + EPSILON) return null;
  return { start: clip.start + (from - source.start) / source.speed, end: clip.start + (to - source.start) / source.speed };
}

/** An analyzer's clocks belong to the uploaded source. Never infer target ownership from timeline overlap. */
export function mapSourceAnalysisToProject(project: EditProject, source: { id: string; duration: number }, analysis: { changes: EditOperation[]; signals: QualitySignal[] }) {
  if (!Number.isFinite(source.duration) || source.duration <= 0) throw new Error("Measure the analyzed source duration before queueing changes.");
  const clips = project.clips.filter(c => c.assetId === source.id && clipLaneKind(c) === "video" && !c.transitionHandle);
  if (!clips.length) throw new Error("This project does not contain the analyzed video. Add that exact source to its timeline first.");
  const changes: EditOperation[] = [], signals: QualitySignal[] = [], rejected: string[] = [];
  for (const change of analysis.changes) {
    if (!validSpan(change.start, change.end, source.duration)) { rejected.push(`${change.label}: invalid source interval`); continue; }
    if (["silence", "move"].includes(change.type) || (change.type === "graphic" && change.parameters?.graphicMode !== "create")) {
      rejected.push(`${change.label}: this operation needs an explicit timeline decision`); continue;
    }
    for (const clip of clips) {
      const mapped = mapSpan(clip, change.start, change.end);
      if (!mapped) continue;
      const sourceClock = sourceSpan(clip);
      const ids = expandLinkedSelection(project, [clip.id], { groups: false, links: true });
      const peers = project.clips.filter(c => ids.includes(c.id));
      if (peers.some(c => c.locked || c.shotTransition || c.transitionHandle) || (clip.linkId && project.clips.some(c => c.linkId === clip.linkId && !ids.includes(c.id)))) {
        rejected.push(`${change.label}: locked or incompatible linked source`); continue;
      }
      if (["delete", "trim", "pacing"].includes(change.type) && (Math.abs(change.start - sourceClock.start) > EPSILON || Math.abs(change.end - sourceClock.end) > EPSILON)) {
        rejected.push(`${change.label}: a partial source interval cannot alter the whole clip`); continue;
      }
      // A proposed trim's sourceIn is already a source clock; reject a mismatch instead of silently shifting it.
      if (change.type === "trim" && change.parameters?.sourceIn !== undefined && Math.abs(change.parameters.sourceIn - sourceClock.start) > EPSILON) {
        rejected.push(`${change.label}: trim source clock is ambiguous`); continue;
      }
      const ownedId = `${change.id}-source-${clip.id}`;
      const parameters = change.type === "caption" ? { ...change.parameters, sourceClipId: clip.id } : change.parameters;
      changes.push({ ...change, id: ownedId, ...mapped, parameters, targetClipIds: change.type === "caption" ? [clip.id] : ids, status: "proposed" });
    }
  }
  for (const signal of analysis.signals) {
    if (!validSpan(signal.start, signal.end, source.duration)) continue;
    for (const clip of clips) {
      const mapped = mapSpan(clip, signal.start, signal.end);
      if (mapped) signals.push({ ...signal, id: `${signal.id}-source-${clip.id}`, ...mapped });
    }
  }
  return { changes, signals, rejected: [...new Set(rejected)] };
}
