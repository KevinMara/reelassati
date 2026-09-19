import { describe, expect, it } from "vitest";
import { createEmptyWorkspace, type Asset } from "@contracts/workspace";
import { normalizeEditorGenerations } from "@contracts/editor-generations";
import {
  AI_COMPLIANCE_POLICY_VERSION,
  AI_PROVENANCE_SCHEME,
} from "@contracts/compliance";
import {
  applyVideoGenerationResult,
  completeEditorGeneration,
  failEditorGeneration,
  nextEditorGeneration,
  recoverEditorGenerations,
  recoverSavedEditorResults,
} from "./editor-generations";

const now = "2026-09-15T10:00:00.000Z";
function asset(id: string, name: string, kind: Asset["kind"] = "image"): Asset {
  return {
    id,
    name,
    kind,
    contentType: kind === "image" ? "image/png" : "audio/wav",
    size: 100,
    url: `/media/${id}`,
    status: "ready",
    createdAt: "2026-09-15T10:00:03.000Z",
    provenance: {
      recordId: `provenance-${id}`,
      origin: "ai-generated",
      operation:
        kind === "image"
          ? "image-generation"
          : kind === "video"
            ? "video-generation"
            : "audio-generation",
      provider: "test",
      model: "test",
      generatedAt: now,
      policyVersion: AI_COMPLIANCE_POLICY_VERSION,
      marking: {
        scheme: AI_PROVENANCE_SCHEME,
        method: "signed-record+sha256-fingerprint",
        status: "verified",
      },
    },
  };
}

describe("editor generation file lifecycle", () => {
  it("allocates independent names for concurrent types and keeps existing names occupied", () => {
    let w = createEmptyWorkspace("test@example.com");
    w.assets = [asset("old", "Image 1.png")];
    const first = nextEditorGeneration(w, "project", "image", "request1", now);
    w = { ...w, editorGenerations: [first] };
    const second = nextEditorGeneration(w, "project", "image", "request2", now);
    const video = nextEditorGeneration(w, "project", "video", "request3", now);
    expect([first.name, second.name, video.name]).toEqual([
      "Image 2",
      "Image 3",
      "Video 1",
    ]);
  });

  it("saves each result once, respects pending renames, and never modifies timeline projects", () => {
    const w = createEmptyWorkspace("test@example.com");
    const record = {
      ...nextEditorGeneration(w, "project", "voice", "request1", now),
      name: "Warm introduction",
    };
    w.editorGenerations = [record];
    const output = asset("result", "Voiceover 1.wav", "audio");
    const completed = completeEditorGeneration(w, record.id, output);
    const repeated = completeEditorGeneration(completed, record.id, output);
    expect(repeated.projects).toBe(w.projects);
    expect(repeated.assets).toHaveLength(1);
    expect(repeated.assets[0]).toMatchObject({
      name: "Warm introduction",
      projectId: "project",
    });
    expect(repeated.editorGenerations?.[0]).toMatchObject({
      status: "completed",
      assetId: "result",
    });
    expect(() =>
      completeEditorGeneration(
        repeated,
        record.id,
        asset("different", "Other voice.wav", "audio")
      )
    ).toThrow("does not match");
    expect(() =>
      completeEditorGeneration(
        w,
        record.id,
        asset("wrong-kind", "Image.png", "image")
      )
    ).toThrow("does not match");
  });

  it("recovers multiple image results by distinct saved request names after reopening", () => {
    const w = createEmptyWorkspace("test@example.com");
    const first = nextEditorGeneration(w, "project", "image", "request1", now);
    w.editorGenerations = [first];
    const second = nextEditorGeneration(w, "project", "image", "request2", now);
    w.editorGenerations.push({
      ...second,
      name: "Client renamed pending file",
    });
    w.assets = [asset("two", "Image 2.png"), asset("one", "Image 1.png")];
    const recovered = recoverEditorGenerations(w);
    expect(
      recovered.editorGenerations?.map(g => [g.id, g.assetId, g.status])
    ).toEqual([
      ["request1", "one", "completed"],
      ["request2", "two", "completed"],
    ]);
    expect(recovered.assets.find(a => a.id === "two")?.name).toBe(
      "Client renamed pending file"
    );
    expect(recovered.projects).toBe(w.projects);
  });

  it("does not associate ambiguous, older or already claimed assets", () => {
    const w = createEmptyWorkspace("test@example.com");
    w.editorGenerations = [
      nextEditorGeneration(w, "project", "music", "request1", now),
    ];
    w.assets = [
      asset("a", "Music 1.wav", "audio"),
      asset("b", "Music 1.wav", "audio"),
    ];
    expect(recoverEditorGenerations(w).editorGenerations?.[0].status).toBe(
      "submitting"
    );
    w.assets = [{ ...w.assets[0], createdAt: "2026-09-14T00:00:00.000Z" }];
    expect(
      recoverEditorGenerations(w).editorGenerations?.[0].assetId
    ).toBeUndefined();
  });

  it("recovers actual video failures without changing unrelated requests", () => {
    const w = createEmptyWorkspace("test@example.com");
    w.editorGenerations = [
      {
        ...nextEditorGeneration(w, "project", "video", "request1", now),
        jobId: "request1",
      },
    ];
    w.jobs = [
      {
        id: "request1",
        type: "video",
        status: "failed",
        progress: 100,
        error: "Provider declined generation",
        createdAt: now,
        updatedAt: now,
      },
    ];
    expect(recoverEditorGenerations(w).editorGenerations?.[0]).toMatchObject({
      status: "failed",
      error: "Provider declined generation",
    });
  });

  it("rejects uploaded namesakes and output attached to a different project", () => {
    const w = createEmptyWorkspace("test@example.com");
    w.editorGenerations = [
      nextEditorGeneration(w, "project", "image", "request1", now),
    ];
    w.assets = [{ ...asset("uploaded", "Image 1.png"), provenance: undefined }];
    expect(
      recoverEditorGenerations(w).editorGenerations?.[0].assetId
    ).toBeUndefined();
    w.assets = [
      {
        ...asset("different-project", "Image 1.png"),
        projectId: "other-project",
      },
    ];
    expect(
      recoverEditorGenerations(w).editorGenerations?.[0].assetId
    ).toBeUndefined();
  });

  it("never claims the same recovered output twice in one reconciliation", () => {
    const w = createEmptyWorkspace("test@example.com");
    const first = nextEditorGeneration(w, "project", "image", "request1", now);
    w.editorGenerations = [first, { ...first, id: "request2" }];
    w.assets = [asset("one", "Image 1.png")];
    const recovered = recoverEditorGenerations(w);
    expect(
      recovered.editorGenerations?.filter(g => g.assetId === "one")
    ).toHaveLength(1);
  });

  it("keeps completed jobs terminal when late pending responses or failures arrive", () => {
    const w = createEmptyWorkspace("test@example.com");
    const record = {
      ...nextEditorGeneration(w, "project", "video", "request1", now),
      jobId: "request1",
    };
    w.editorGenerations = [record];
    const job = {
      id: "request1",
      type: "video" as const,
      projectId: "project",
      status: "completed" as const,
      progress: 100,
      resultAssetId: "video",
      createdAt: now,
      updatedAt: now,
    };
    const completed = applyVideoGenerationResult(w, "request1", {
      job,
      asset: asset("video", "Video 1.mp4", "video"),
    });
    const late = applyVideoGenerationResult(completed, "request1", {
      job: { ...job, status: "in_progress", progress: 12 },
    });
    const failed = failEditorGeneration(late, "request1", "Connection closed");
    expect(failed.editorGenerations?.[0].status).toBe("completed");
    expect(failed.jobs[0].status).toBe("completed");
    expect(failed.assets).toHaveLength(1);
    expect(() =>
      applyVideoGenerationResult(w, "request1", {
        job: { ...job, projectId: "other-project" },
      })
    ).toThrow("does not belong");
    expect(() =>
      applyVideoGenerationResult(w, "request1", {
        job,
        asset: asset("wrong-output", "Video 1.mp4", "video"),
      })
    ).toThrow("mismatched");
  });

  it("refreshes a recovered file URL without undoing a later library rename or folder choice", () => {
    const w = createEmptyWorkspace("test@example.com");
    w.editorGenerations = [
      nextEditorGeneration(w, "project", "image", "request1", now),
    ];
    const first = completeEditorGeneration(
      w,
      "request1",
      asset("one", "Image 1.png")
    );
    first.assets[0] = {
      ...first.assets[0],
      name: "Renamed elsewhere",
      folderId: "client-shoot",
      favorite: true,
      url: "/expired",
    };
    const refreshed = completeEditorGeneration(first, "request1", {
      ...asset("one", "Image 1.png"),
      url: "/fresh-signed-url",
    });
    expect(refreshed.assets[0]).toMatchObject({
      name: "Renamed elsewhere",
      folderId: "client-shoot",
      favorite: true,
      url: "/fresh-signed-url",
    });
  });

  it("merges a late recovery response without losing edits or downgrading completed results", () => {
    const w = createEmptyWorkspace("test@example.com");
    const record = nextEditorGeneration(w, "project", "image", "request1", now);
    w.editorGenerations = [record];
    const completed = completeEditorGeneration(
      w,
      record.id,
      asset("one", "Image 1.png")
    );
    completed.assets[0].name = "Renamed while check was pending";
    const recovered = recoverSavedEditorResults(
      completed,
      { assets: [{ ...asset("one", "Image 1.png"), url: "/fresh" }], jobs: [] },
      record.id
    );
    expect(recovered.editorGenerations?.[0].status).toBe("completed");
    expect(recovered.assets[0]).toMatchObject({
      name: "Renamed while check was pending",
      url: "/fresh",
    });
    const failed = failEditorGeneration(w, record.id, "Provider unavailable");
    failed.editorGenerations![0].name = "Renamed failed request";
    const noOutput = recoverSavedEditorResults(
      failed,
      { assets: [], jobs: [] },
      record.id
    );
    expect(noOutput.editorGenerations?.[0]).toMatchObject({
      status: "failed",
      name: "Renamed failed request",
      error: "Provider unavailable",
    });
  });

  it("normalizes only supported request metadata and drops arbitrary payload fields", () => {
    const w = createEmptyWorkspace("test@example.com");
    const record = nextEditorGeneration(w, "project", "image", "request1", now);
    const normalized = normalizeEditorGenerations([
      { ...record, token: "untrusted", name: "a".repeat(300) },
      { ...record, kind: "unsupported" },
      null,
    ]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].name).toHaveLength(240);
    expect(normalized[0]).not.toHaveProperty("token");
  });
});
