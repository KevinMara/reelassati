import { describe, expect, it } from "vitest";
import {
  previewReadiness,
  type PreviewSourceReadiness,
} from "./preview-buffering";
const ready: PreviewSourceReadiness = {
  kind: "media",
  readyState: 4,
  seeking: false,
  error: false,
};
describe("preview readiness", () => {
  it("holds all playback if either the picture or accompanying audio is not ready", () => {
    expect(previewReadiness([{ ...ready, readyState: 0 }, ready])).toBe(
      "loading"
    );
    expect(previewReadiness([ready, { ...ready, readyState: 2 }])).toBe(
      "loading"
    );
    expect(previewReadiness([ready, { ...ready, seeking: true }])).toBe(
      "loading"
    );
    expect(previewReadiness([ready, ready])).toBe("ready");
  });
  it("allows genuine gaps and decoded final frames rather than deadlocking at the end", () => {
    expect(previewReadiness([])).toBe("ready");
    expect(previewReadiness([{ ...ready, readyState: 2, ended: true }])).toBe(
      "ready"
    );
  });
  it("requires loaded images and distinguishes a failed source for a user retry", () => {
    expect(
      previewReadiness([{ kind: "image", error: false, complete: false }])
    ).toBe("loading");
    expect(
      previewReadiness([
        { kind: "image", error: false, complete: true, naturalWidth: 1920 },
      ])
    ).toBe("ready");
    expect(
      previewReadiness([
        { kind: "image", error: false, complete: true, naturalWidth: 0 },
      ])
    ).toBe("error");
    expect(previewReadiness([{ ...ready, error: true }])).toBe("error");
  });
});
