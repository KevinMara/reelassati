import type { WorkspaceEvent } from "./workspace";

/** Exact labels emitted by the application. Detail text and custom labels are content. */
export const WORKSPACE_ACTIVITY_UI_LABELS = [
  { type: "project", label: "Project created" },
  { type: "project", label: "Library media added" },
  { type: "project", label: "Media uploaded and added" },
  { type: "upload", label: "Asset uploaded" },
  { type: "upload", label: "Voice note uploaded" },
  { type: "upload", label: "Speech generated" },
  { type: "script", label: "Script generated" },
  { type: "script", label: "Script updated" },
  { type: "script", label: "Interview script generated" },
  { type: "script", label: "Voice note turned into script" },
  { type: "generation", label: "Image generated" },
  { type: "generation", label: "Video generated" },
  { type: "generation", label: "Video generation failed" },
  { type: "generation", label: "Video continuation started" },
  { type: "generation", label: "Video generation started" },
  { type: "generation", label: "Voice note transcribed" },
  { type: "publish", label: "Publication draft saved" },
  { type: "publish", label: "Post scheduled" },
  { type: "publish", label: "Post published" },
  { type: "publish", label: "Publication status updated" },
  { type: "goal", label: "Goal created" },
  { type: "goal", label: "Goal achieved" },
  { type: "goal", label: "Goal progress updated" },
  { type: "calendar", label: "Calendar event created" },
  { type: "calendar", label: "Calendar event updated" },
  { type: "calendar", label: "Calendar event deleted" },
] satisfies Array<{ type: WorkspaceEvent["type"]; label: string }>;

export function isWorkspaceInterfaceActivity(
  type: WorkspaceEvent["type"],
  label: string
) {
  return WORKSPACE_ACTIVITY_UI_LABELS.some(
    item => item.type === type && item.label === label
  );
}
