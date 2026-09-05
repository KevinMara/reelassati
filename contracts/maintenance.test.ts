import { it, expect } from "vitest";
import { isAuthorizedMaintenanceIdentity } from "./maintenance";
it("limits scheduler identity to the exact repository, workflow and production branch", () => {
  const p = {
    repository_id: "1248417952",
    repository_owner_id: "208570955",
    repository: "KevinMara/reelassati",
    ref: "refs/heads/main",
    workflow_ref:
      "KevinMara/reelassati/.github/workflows/maintenance.yml@refs/heads/main",
    event_name: "schedule",
  };
  expect(isAuthorizedMaintenanceIdentity(p)).toBe(true);
  expect(
    isAuthorizedMaintenanceIdentity({ ...p, repository_id: "other" })
  ).toBe(false);
  expect(
    isAuthorizedMaintenanceIdentity({ ...p, event_name: "pull_request" })
  ).toBe(false);
  expect(
    isAuthorizedMaintenanceIdentity({ ...p, ref: "refs/heads/preview" })
  ).toBe(false);
  expect(
    isAuthorizedMaintenanceIdentity({ ...p, workflow_ref: "another workflow" })
  ).toBe(false);
});
