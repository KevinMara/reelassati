import { expect, it } from "vitest";
import { hashRouteForDeepLink } from "./deep-link";
it("opens shared pricing and editor links with their query parameters", () => {
  expect(hashRouteForDeepLink("/pricing", "?plan=pro", "")).toBe(
    "/#/pricing?plan=pro"
  );
  expect(hashRouteForDeepLink("/dashboard/edit", "", "")).toBe(
    "/#/dashboard/edit"
  );
});
it("preserves existing hash routes and authentication callback parameters", () => {
  expect(hashRouteForDeepLink("/pricing", "", "#/auth/login")).toBeNull();
  expect(
    hashRouteForDeepLink("/auth/callback", "?code=example", "")
  ).toBeNull();
});
