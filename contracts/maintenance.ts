import type { JWTPayload } from "jose";
export function isAuthorizedMaintenanceIdentity(payload: JWTPayload): boolean {
  return (
    payload.repository_id === "1248417952" &&
    payload.repository_owner_id === "208570955" &&
    payload.repository === "KevinMara/reelassati" &&
    payload.ref === "refs/heads/main" &&
    payload.workflow_ref ===
      "KevinMara/reelassati/.github/workflows/maintenance.yml@refs/heads/main" &&
    ["schedule", "workflow_dispatch"].includes(String(payload.event_name))
  );
}
