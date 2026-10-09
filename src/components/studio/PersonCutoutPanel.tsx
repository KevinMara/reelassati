import { StillImageToolPanel } from "./StillImageToolPanel";

export function PersonCutoutPanel({ projectId }: { projectId: string }) {
  return <StillImageToolPanel key={projectId} projectId={projectId} kind="person" />;
}
