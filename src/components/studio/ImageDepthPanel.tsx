import { StillImageToolPanel } from "./StillImageToolPanel";

export function ImageDepthPanel({ projectId }: { projectId: string }) {
  return <StillImageToolPanel key={projectId} projectId={projectId} kind="depth" />;
}
