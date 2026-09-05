import { afterEach, describe, expect, it } from "vitest";
import {
  extractTextProvenanceToken,
  withoutTextProvenanceMarker,
  type ContentProvenance,
} from "../contracts/compliance";
import {
  createEmptyWorkspace,
  type Asset,
  type EditOperation,
  type EditProject,
  type ScriptDraft,
} from "../contracts/workspace";
import { embedMediaProvenanceMarker } from "./media-provenance";
import worker from "./server";

type StoredRow = Record<string, unknown>;

function createIntegrityD1() {
  const state = {
    provenance: [] as StoredRow[],
    invocations: [] as StoredRow[],
    assets: [] as StoredRow[],
    events: [] as StoredRow[],
    workspaces: [] as StoredRow[],
    creditLedger: [] as StoredRow[],
  };

  const prepare = (query: string) => {
    const normalized = query.replace(/\s+/g, " ").trim().toLowerCase();
    let bindings: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        bindings = values;
        return statement;
      },
      run: async () => {
        let changes = 1;
        if (normalized.includes("insert into credit_ledger")) {
          state.creditLedger.push({
            id: bindings[0],
            amount: -Number(bindings[1]),
            status: "reserved",
            operation_key: bindings[6],
          });
        } else if (
          normalized.startsWith("update credit_ledger") &&
          normalized.includes("status = 'settled'")
        ) {
          const row = state.creditLedger.find(item => item.id === bindings[1]);
          if (row) row.status = "settled";
        } else if (normalized.includes("insert into ai_provenance_records")) {
          const [
            id,
            publicToken,
            ownerEmail,
            entityType,
            entityId,
            origin,
            operation,
            provider,
            model,
            policyVersion,
            signingKeyId,
            markingMethod,
            markingStatus,
            contentSha256,
            metadataJson,
            createdAt,
          ] = bindings;
          state.provenance.push({
            id,
            public_token: publicToken,
            owner_email: ownerEmail,
            entity_type: entityType,
            entity_id: entityId,
            origin,
            operation,
            provider,
            model,
            policy_version: policyVersion,
            signing_key_id: signingKeyId,
            marking_method: markingMethod,
            marking_status: markingStatus,
            content_sha256: contentSha256,
            metadata_json: metadataJson,
            created_at: createdAt,
            deleted_at: null,
          });
        } else if (
          normalized.startsWith("update ai_provenance_records") &&
          normalized.includes("marking_status = 'verified'")
        ) {
          const row = state.provenance.find(
            item => item.id === bindings[0] && item.owner_email === bindings[1]
          );
          if (row && row.marking_status === "pending") {
            row.marking_status = "verified";
          }
        } else if (
          normalized.startsWith("update ai_provenance_records") &&
          normalized.includes("marking_status = 'failed'")
        ) {
          const row = state.provenance.find(
            item => item.id === bindings[0] && item.owner_email === bindings[1]
          );
          if (row) row.marking_status = "failed";
        } else if (normalized.includes("insert into ai_invocations")) {
          const [
            id,
            ownerEmail,
            purpose,
            provider,
            model,
            policyVersion,
            inputSha256,
            createdAt,
          ] = bindings;
          state.invocations.push({
            id,
            owner_email: ownerEmail,
            purpose,
            provider,
            model,
            policy_version: policyVersion,
            input_sha256: inputSha256,
            status: "in_progress",
            created_at: createdAt,
          });
        } else if (
          normalized.startsWith("update ai_invocations") &&
          normalized.includes("status = 'completed'")
        ) {
          const row = state.invocations.find(item => item.id === bindings[2]);
          if (row && row.status === "in_progress") {
            row.output_sha256 = bindings[0];
            row.status = "completed";
            row.completed_at = bindings[1];
          }
        } else if (
          normalized.startsWith("update ai_invocations") &&
          normalized.includes("status = 'failed'")
        ) {
          const row = state.invocations.find(item => item.id === bindings[2]);
          if (row && row.status === "in_progress") {
            row.status = "failed";
            row.error_code = bindings[0];
            row.completed_at = bindings[1];
          }
        } else if (normalized.includes("insert into compliance_events")) {
          const [
            id,
            ownerEmail,
            eventType,
            entityType,
            entityId,
            policyVersion,
            detailsJson,
            createdAt,
          ] = bindings;
          state.events.push({
            id,
            owner_email: ownerEmail,
            event_type: eventType,
            entity_type: entityType,
            entity_id: entityId,
            policy_version: policyVersion,
            details_json: detailsJson,
            created_at: createdAt,
          });
        } else if (normalized.includes("insert into assets")) {
          const [
            id,
            ownerEmail,
            name,
            kind,
            contentType,
            bytes,
            r2Key,
            createdAt,
          ] = bindings;
          state.assets.push({
            id,
            owner_email: ownerEmail,
            name,
            kind,
            content_type: contentType,
            bytes,
            r2_key: r2Key,
            created_at: createdAt,
          });
        } else if (normalized.startsWith("delete from assets")) {
          const index = state.assets.findIndex(
            row => row.id === bindings[0] && row.owner_email === bindings[1]
          );
          if (index >= 0) state.assets.splice(index, 1);
        } else if (normalized.startsWith("delete from ai_provenance_records")) {
          const index = state.provenance.findIndex(
            row => row.id === bindings[0] && row.owner_email === bindings[1]
          );
          if (index >= 0) state.provenance.splice(index, 1);
        } else if (normalized.includes("insert into workspace_state")) {
          if (state.workspaces.some(row => row.owner_email === bindings[0])) {
            changes = 0;
          } else {
            state.workspaces.push({
              owner_email: bindings[0],
              document: bindings[1],
              updated_at: bindings[2],
              revision: 0,
            });
          }
        } else if (normalized.startsWith("update workspace_state")) {
          const row = state.workspaces.find(
            candidate =>
              candidate.owner_email === bindings[3] &&
              candidate.revision === bindings[4]
          );
          if (row) {
            row.document = bindings[0];
            row.updated_at = bindings[1];
            row.revision = bindings[2];
          } else {
            changes = 0;
          }
        }
        return { success: true, meta: { changes } };
      },
      first: async () => {
        if (
          normalized.includes("from billing_accounts where owner_email = ?")
        ) {
          return {
            owner_email: bindings[0],
            plan_id: "studio",
            billing_cycle: "monthly",
            status: "active",
            current_period_end: "2099-12-31T00:00:00.000Z",
            cancel_at_period_end: 0,
          };
        }
        if (
          normalized.includes(
            "select included_balance, topup_balance from credit_accounts"
          )
        ) {
          return { included_balance: 100_000, topup_balance: 0 };
        }
        if (
          normalized.includes("select id, amount, status from credit_ledger")
        ) {
          return (
            state.creditLedger.find(row => row.operation_key === bindings[0]) ||
            null
          );
        }
        if (
          normalized.includes("$.profile.credits") ||
          normalized.includes("sum(credit_cost)")
        ) {
          return { credits: 0 };
        }
        if (normalized.includes("from ai_provenance_records")) {
          if (normalized.includes("public_token = ?")) {
            return (
              state.provenance.find(
                row => row.public_token === bindings.at(-1)
              ) || null
            );
          }
          if (normalized.includes("content_sha256 = ?")) {
            return (
              state.provenance.find(
                row =>
                  row.content_sha256 === bindings[0] &&
                  row.marking_status === "verified"
              ) || null
            );
          }
          if (
            normalized.includes("owner_email = ?") &&
            normalized.includes("entity_type = ?") &&
            normalized.includes("entity_id = ?")
          ) {
            return (
              state.provenance.find(
                row =>
                  row.owner_email === bindings[0] &&
                  row.entity_type === bindings[1] &&
                  row.entity_id === bindings[2]
              ) || null
            );
          }
          if (
            normalized.includes("where id = ?") &&
            normalized.includes("owner_email = ?")
          ) {
            return (
              state.provenance.find(
                row => row.id === bindings[0] && row.owner_email === bindings[1]
              ) || null
            );
          }
        }
        if (
          normalized.includes("from assets") &&
          normalized.includes("where id = ?")
        ) {
          return (
            state.assets.find(
              row => row.id === bindings[0] && row.owner_email === bindings[1]
            ) || null
          );
        }
        if (
          normalized.includes("from workspace_state") &&
          normalized.includes("revision")
        ) {
          return (
            state.workspaces.find(row => row.owner_email === bindings[0]) ||
            null
          );
        }
        return null;
      },
      all: async () => {
        if (normalized.includes("from ai_provenance_records")) {
          return {
            success: true,
            results: state.provenance.filter(
              row => !bindings.length || row.owner_email === bindings[0]
            ),
          };
        }
        if (normalized.includes("from assets")) {
          return {
            success: true,
            results: state.assets.filter(
              row => !bindings.length || row.owner_email === bindings[0]
            ),
          };
        }
        return { success: true, results: [] };
      },
      raw: async () => [],
    };
    return statement;
  };

  return {
    state,
    prepare,
    batch: async (statements: Array<{ run(): Promise<unknown> }>) =>
      Promise.all(statements.map(statement => statement.run())),
  };
}

async function bodyBytes(
  value: ReadableStream | ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  return new Uint8Array(await new Response(value).arrayBuffer());
}

function createMemoryBucket(failWrites = false) {
  const objects = new Map<
    string,
    {
      bytes: Uint8Array;
      etag: string;
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    }
  >();
  let version = 0;

  const overwritePreservingMetadata = (key: string, bytes: ArrayBuffer) => {
    const current = objects.get(key);
    if (!current) throw new Error("Missing test object");
    objects.set(key, {
      ...current,
      bytes: new Uint8Array(bytes.slice(0)),
      etag: `etag-${++version}`,
    });
  };

  return {
    objects,
    overwritePreservingMetadata,
    put: async (
      key: string,
      value: ReadableStream | ArrayBuffer | Uint8Array,
      options?: {
        httpMetadata?: { contentType?: string };
        customMetadata?: Record<string, string>;
      }
    ) => {
      if (failWrites) {
        throw new Error("super-secret-storage-stack");
      }
      objects.set(key, {
        bytes: await bodyBytes(value),
        etag: `etag-${++version}`,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
      });
    },
    get: async (
      key: string,
      options?: { range?: { offset: number; length?: number } }
    ) => {
      const stored = objects.get(key);
      if (!stored) return null;
      const range = options?.range;
      const selected = range
        ? stored.bytes.slice(
            range.offset,
            range.offset + (range.length || stored.bytes.byteLength)
          )
        : stored.bytes.slice();
      return {
        body: new Response(selected).body,
        size: stored.bytes.byteLength,
        etag: stored.etag,
        httpEtag: `"${stored.etag}"`,
        httpMetadata: stored.httpMetadata,
        customMetadata: stored.customMetadata,
        arrayBuffer: async () => selected.slice().buffer,
      };
    },
    delete: async (key: string) => {
      objects.delete(key);
    },
  };
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const authHeaders = {
  "content-type": "application/json",
  "oai-authenticated-user-email": "creator@example.com",
};
const signingKey = "test-only-provenance-signing-key-32-characters";
const rawMp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);

function testEnv(
  DB: ReturnType<typeof createIntegrityD1>,
  BUCKET: ReturnType<typeof createMemoryBucket>
) {
  return {
    ASSETS: { fetch: async () => new Response("not found", { status: 404 }) },
    DB,
    BUCKET,
    OPENROUTER_API_KEY: "test-openrouter-key",
    AI_PROVENANCE_SIGNING_KEY: signingKey,
    AI_PROVENANCE_SIGNING_KEY_ID: "integrity-test-v1",
  };
}

async function generateSpeech(
  DB: ReturnType<typeof createIntegrityD1>,
  BUCKET: ReturnType<typeof createMemoryBucket>
): Promise<Asset> {
  globalThis.fetch = async () => new Response(rawMp3);
  const response = await worker.fetch(
    new Request("https://studio.example/api/ai/speech", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        text: "A verified voice take",
        voice: "test-voice",
        rightsConfirmed: true,
      }),
    }),
    testEnv(DB, BUCKET) as never
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { asset: Asset }).asset;
}

function operationProjection(operation: EditOperation) {
  return {
    id: operation.id,
    type: operation.type,
    label: operation.label,
    reason: operation.reason,
    start: operation.start,
    end: operation.end,
    confidence: operation.confidence,
    intensity: operation.intensity,
    targetClipIds: operation.targetClipIds,
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

describe("provenance integrity boundaries", () => {
  it("binds displayed script fields and never preserves a stale signed badge", async () => {
    const DB = createIntegrityD1();
    const BUCKET = createMemoryBucket();
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Canonical title",
                hook: "Canonical hook",
                body: "Canonical body",
                cta: "Canonical CTA",
                fullScript: "Canonical hook\n\nCanonical body\n\nCanonical CTA",
              }),
            },
          },
        ],
      });
    const env = testEnv(DB, BUCKET);
    const generated = await worker.fetch(
      new Request("https://studio.example/api/ai/script", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ topic: "Canonical provenance" }),
      }),
      env as never
    );
    expect(generated.status).toBe(200);
    const original = ((await generated.json()) as { script: ScriptDraft })
      .script;

    const initialWorkspace = createEmptyWorkspace(
      "creator@example.com",
      "Creator"
    );
    initialWorkspace.scripts = [original];
    const firstSave = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ workspace: initialWorkspace }),
      }),
      env as never
    );
    expect(firstSave.status).toBe(200);
    const firstWorkspace = (await firstSave.json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    expect(firstWorkspace.workspace.scripts[0]).toMatchObject({
      hook: "Canonical hook",
      provenance: { recordId: original.provenance?.recordId },
    });

    const bumpSave = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ workspace: firstWorkspace.workspace }),
      }),
      env as never
    );
    expect(bumpSave.status).toBe(200);
    const bumpedWorkspace = (await bumpSave.json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    const originalRecordCount = DB.state.provenance.length;

    const staleSave = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          workspace: {
            ...firstWorkspace.workspace,
            scripts: [
              {
                ...firstWorkspace.workspace.scripts[0],
                hook: "Rejected stale edit",
              },
            ],
          },
        }),
      }),
      env as never
    );
    expect(staleSave.status).toBe(409);
    expect(DB.state.provenance).toHaveLength(originalRecordCount);

    const oversizedSave = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          workspace: {
            ...bumpedWorkspace.workspace,
            scripts: [
              {
                ...bumpedWorkspace.workspace.scripts[0],
                hook: "Rejected oversized edit",
              },
            ],
            activity: [
              {
                id: "oversized",
                type: "script",
                label: "x".repeat(2_100_000),
                detail: "oversized",
                createdAt: "2026-08-04T00:00:00.000Z",
              },
            ],
          },
        }),
      }),
      env as never
    );
    expect(oversizedSave.status).toBe(413);
    expect(DB.state.provenance).toHaveLength(originalRecordCount);

    const forgedStructuredFields = {
      ...bumpedWorkspace.workspace,
      scripts: [
        {
          ...bumpedWorkspace.workspace.scripts[0],
          hook: "Forged hook while old fullScript stays unchanged",
        },
      ],
    };
    const editedSave = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ workspace: forgedStructuredFields }),
      }),
      env as never
    );
    expect(editedSave.status).toBe(200);
    const editedWorkspace = (await editedSave.json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    const derivative = editedWorkspace.workspace.scripts[0];
    expect(derivative.hook).toBe(
      "Forged hook while old fullScript stays unchanged"
    );
    expect(derivative.provenance).toMatchObject({ origin: "ai-manipulated" });
    expect(derivative.provenance?.recordId).not.toBe(
      original.provenance?.recordId
    );
    expect(extractTextProvenanceToken(derivative.fullScript)).toBe(
      derivative.provenance?.marking.publicToken
    );

    const stored = DB.state.workspaces[0];
    const corrupted = JSON.parse(String(stored.document)) as ReturnType<
      typeof createEmptyWorkspace
    >;
    corrupted.scripts[0].hook = "Post-save storage tamper";
    stored.document = JSON.stringify(corrupted);
    const reloaded = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        headers: authHeaders,
      }),
      env as never
    );
    const reloadedWorkspace = (await reloaded.json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    expect(reloadedWorkspace.workspace.scripts[0].hook).toBe(
      "Post-save storage tamper"
    );
    expect(reloadedWorkspace.workspace.scripts[0].provenance).toBeUndefined();
    expect(
      extractTextProvenanceToken(
        reloadedWorkspace.workspace.scripts[0].fullScript
      )
    ).toBeNull();
  });

  it("round-trips owner-bound transcript provenance through save, revision, reload and export", async () => {
    const DB = createIntegrityD1();
    const BUCKET = createMemoryBucket();
    const env = testEnv(DB, BUCKET);
    const now = "2026-08-04T00:00:00.000Z";
    const project: EditProject = {
      id: "editor-project-a",
      title: "Transcript lifecycle",
      template: "blank",
      status: "editing",
      platform: "tiktok",
      aspectRatio: "9:16",
      duration: 15,
      playhead: 0,
      createdAt: now,
      updatedAt: now,
      clips: [],
      transcript: [],
      proposedChanges: [],
      qualitySignals: [],
      revisions: [
        {
          id: "revision-manual-before-ai",
          label: "Manual transcript",
          createdAt: now,
          clips: [],
          transcript: [
            { id: "manual-line", start: 0, end: 1, text: "Manual history" },
          ],
        },
      ],
    };
    const initialWorkspace = createEmptyWorkspace(
      "creator@example.com",
      "Creator"
    );
    initialWorkspace.projects = [project];
    const initialSave = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ workspace: initialWorkspace }),
      }),
      env as never
    );
    expect(initialSave.status).toBe(200);
    const savedInitial = (await initialSave.json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };

    const r2Key = "users/creator/assets/source.mp3";
    DB.state.assets.push({
      id: "source-audio",
      owner_email: "creator@example.com",
      name: "source.mp3",
      kind: "audio",
      content_type: "audio/mpeg",
      bytes: rawMp3.byteLength,
      r2_key: r2Key,
      created_at: now,
    });
    await BUCKET.put(r2Key, rawMp3, {
      httpMetadata: { contentType: "audio/mpeg" },
    });
    globalThis.fetch = async () =>
      Response.json({
        text: "First line Second line",
        segments: [
          { start: 0, end: 1, text: "First line" },
          { start: 1, end: 2, text: "Second line" },
        ],
      });
    const transcribed = await worker.fetch(
      new Request("https://studio.example/api/ai/transcribe", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          assetId: "source-audio",
          projectId: project.id,
          language: "en",
        }),
      }),
      env as never
    );
    expect(transcribed.status).toBe(200);
    const transcriptResult = (await transcribed.json()) as {
      transcript: string;
      segments: EditProject["transcript"];
      provenance: ContentProvenance;
    };
    expect(extractTextProvenanceToken(transcriptResult.transcript)).toBe(
      transcriptResult.provenance.marking.publicToken
    );

    const withTranscript = {
      ...savedInitial.workspace,
      projects: [
        {
          ...project,
          transcript: transcriptResult.segments,
          transcriptProvenance: transcriptResult.provenance,
          revisions: [
            project.revisions[0],
            {
              id: "revision-transcribed",
              label: "Media transcribed",
              createdAt: now,
              clips: [],
              transcript: transcriptResult.segments,
              transcriptProvenance: transcriptResult.provenance,
            },
          ],
        },
      ],
    };
    const transcriptSave = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ workspace: withTranscript }),
      }),
      env as never
    );
    expect(transcriptSave.status).toBe(200);

    const reloaded = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        headers: authHeaders,
      }),
      env as never
    );
    const reloadedBody = (await reloaded.json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    const reloadedProject = reloadedBody.workspace.projects[0];
    expect(reloadedProject.transcriptProvenance?.recordId).toBe(
      transcriptResult.provenance.recordId
    );
    expect(reloadedProject.revisions[0].transcriptProvenance).toBeUndefined();
    expect(reloadedProject.revisions[0].transcript[0].text).toBe(
      "Manual history"
    );
    expect(reloadedProject.revisions[1].transcriptProvenance?.recordId).toBe(
      transcriptResult.provenance.recordId
    );

    const exported = await worker.fetch(
      new Request(
        `https://studio.example/api/projects/${project.id}/edit-brief`,
        { headers: authHeaders }
      ),
      env as never
    );
    expect(exported.status).toBe(200);
    const exportBody = (await exported.json()) as {
      brief: {
        project: {
          transcriptText: string;
          transcriptProvenance: ContentProvenance;
        };
      };
    };
    expect(
      withoutTextProvenanceMarker(exportBody.brief.project.transcriptText)
    ).toBe("First line\nSecond line");
    const detection = await worker.fetch(
      new Request("https://studio.example/api/provenance/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: exportBody.brief.project.transcriptText,
        }),
      }),
      env as never
    );
    expect(await detection.json()).toMatchObject({
      matched: true,
      verification: "artifact-verified",
    });

    const forgedProject: EditProject = {
      ...project,
      id: "editor-project-b",
      transcript: transcriptResult.segments,
      transcriptProvenance: transcriptResult.provenance,
    };
    const tamperedSave = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          workspace: {
            ...reloadedBody.workspace,
            projects: [reloadedProject, forgedProject],
          },
        }),
      }),
      env as never
    );
    expect(tamperedSave.status).toBe(200);
    const tamperedBody = (await tamperedSave.json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    expect(
      tamperedBody.workspace.projects[1].transcriptProvenance
    ).toBeUndefined();
  });

  it("binds normalized edit-plan provenance to the exact project and operation", async () => {
    const DB = createIntegrityD1();
    const BUCKET = createMemoryBucket();
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Tighten the opening",
                changes: [
                  {
                    type: "trim",
                    label: "Trim the intro",
                    reason: "Reach the first proof sooner",
                    start: -10,
                    end: 900,
                    confidence: 4,
                    intensity: "light",
                  },
                ],
              }),
            },
          },
        ],
      });
    const project = {
      id: "project-a",
      title: "Launch reel",
      duration: 30,
      platform: "tiktok",
      aspectRatio: "9:16",
      clips: [
        {
          id: "clip-a",
          track: "video",
          label: "Intro",
          start: 0,
          duration: 30,
          inPoint: 0,
          outPoint: 30,
          locked: false,
          color: "#000",
        },
      ],
      transcript: [],
      qualitySignals: [],
      proposedChanges: [],
      revisions: [],
    };
    const generated = await worker.fetch(
      new Request("https://studio.example/api/ai/edit-plan", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ project, command: "Tighten the opening" }),
      }),
      testEnv(DB, BUCKET) as never
    );
    expect(generated.status).toBe(200);
    const plan = (await generated.json()) as {
      summary: string;
      changes: EditOperation[];
      provenance: ContentProvenance;
    };
    expect(plan.changes[0]).toMatchObject({ start: 0, end: 30, confidence: 1 });

    const projectionSha = await sha256(
      JSON.stringify({
        summary: plan.summary,
        changes: plan.changes.map(operationProjection),
      })
    );
    const detection = await worker.fetch(
      new Request("https://studio.example/api/provenance/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sha256: projectionSha }),
      }),
      testEnv(DB, BUCKET) as never
    );
    expect(await detection.json()).toMatchObject({
      matched: true,
      verification: "artifact-verified",
    });

    const exactWithoutClientProjection = { ...plan.changes[0] };
    delete exactWithoutClientProjection.provenance;
    const mutated = {
      ...plan.changes[0],
      label: "Delete the entire approved project",
    };
    const arbitrary = {
      ...plan.changes[0],
      id: "arbitrary-operation",
      reason: "Copied authentic record",
    };
    const saved = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          workspace: {
            version: 1,
            revision: 0,
            profile: { email: "creator@example.com", name: "Creator" },
            projects: [
              {
                ...project,
                proposedChanges: [
                  plan.changes[0],
                  exactWithoutClientProjection,
                  mutated,
                  arbitrary,
                ],
              },
              {
                ...project,
                id: "project-b",
                proposedChanges: [plan.changes[0]],
              },
            ],
          },
        }),
      }),
      testEnv(DB, BUCKET) as never
    );
    expect(saved.status).toBe(200);
    const workspace = (await saved.json()) as {
      workspace: {
        projects: Array<{ proposedChanges: EditOperation[] }>;
      };
    };
    const [sameProject, otherProject] = workspace.workspace.projects;
    expect(sameProject.proposedChanges[0].provenance?.recordId).toBe(
      plan.provenance.recordId
    );
    expect(sameProject.proposedChanges[1].provenance?.recordId).toBe(
      plan.provenance.recordId
    );
    expect(sameProject.proposedChanges[2].provenance).toBeUndefined();
    expect(sameProject.proposedChanges[3].provenance).toBeUndefined();
    expect(otherProject.proposedChanges[0].provenance).toBeUndefined();
  });

  it("rolls back every speech integrity record when marked-object storage fails", async () => {
    const DB = createIntegrityD1();
    const BUCKET = createMemoryBucket(true);
    globalThis.fetch = async () => new Response(rawMp3);
    const response = await worker.fetch(
      new Request("https://studio.example/api/ai/speech", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          text: "A voice take that must fail closed",
          rightsConfirmed: true,
        }),
      }),
      testEnv(DB, BUCKET) as never
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "OUTPUT_STORAGE_FAILED",
    });
    expect(DB.state.provenance).toHaveLength(1);
    expect(DB.state.provenance[0].marking_status).toBe("failed");
    expect(DB.state.invocations).toHaveLength(1);
    expect(DB.state.invocations[0]).toMatchObject({
      status: "failed",
      error_code: "audio-storage-write-failure",
    });
    expect(DB.state.assets).toHaveLength(0);
    expect(BUCKET.objects.size).toBe(0);
    const rollbackEvent = DB.state.events.find(
      event => event.event_type === "speech.output-rollback"
    );
    expect(rollbackEvent).toBeTruthy();
    expect(String(rollbackEvent?.details_json)).toContain(
      "audio-storage-write-failure"
    );
    expect(String(rollbackEvent?.details_json)).not.toContain(
      "super-secret-storage-stack"
    );
  });

  it("verifies current generated bytes for GET, HEAD and range delivery", async () => {
    const DB = createIntegrityD1();
    const BUCKET = createMemoryBucket();
    const asset = await generateSpeech(DB, BUCKET);
    const env = testEnv(DB, BUCKET);

    const full = await worker.fetch(
      new Request(`https://studio.example${asset.url}`, {
        headers: { "oai-authenticated-user-email": "creator@example.com" },
      }),
      env as never
    );
    expect(full.status).toBe(200);
    expect(full.headers.get("X-REELassati-Provenance")).toBe(
      asset.provenance?.marking.publicToken
    );
    expect((await full.arrayBuffer()).byteLength).toBe(asset.size);

    const head = await worker.fetch(
      new Request(`https://studio.example${asset.url}`, {
        method: "HEAD",
        headers: { "oai-authenticated-user-email": "creator@example.com" },
      }),
      env as never
    );
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Length")).toBe(String(asset.size));

    const range = await worker.fetch(
      new Request(`https://studio.example${asset.url}`, {
        headers: {
          "oai-authenticated-user-email": "creator@example.com",
          range: "bytes=0-3",
        },
      }),
      env as never
    );
    expect(range.status).toBe(206);
    expect((await range.arrayBuffer()).byteLength).toBe(4);
  });

  it("blocks metadata-preserving byte corruption on full GET and HEAD", async () => {
    const DB = createIntegrityD1();
    const BUCKET = createMemoryBucket();
    const firstAsset = await generateSpeech(DB, BUCKET);
    const firstRow = DB.state.assets.find(row => row.id === firstAsset.id);
    const alternateMp3 = new Uint8Array(rawMp3);
    alternateMp3[alternateMp3.length - 1] ^= 0xff;
    const alternateMarked = embedMediaProvenanceMarker(
      alternateMp3.buffer,
      "audio/mpeg",
      firstAsset.provenance?.marking.publicToken || ""
    );
    expect(alternateMarked).not.toBeNull();
    BUCKET.overwritePreservingMetadata(
      String(firstRow?.r2_key),
      alternateMarked?.bytes || new ArrayBuffer(0)
    );

    const corruptedGet = await worker.fetch(
      new Request(`https://studio.example${firstAsset.url}`, {
        headers: { "oai-authenticated-user-email": "creator@example.com" },
      }),
      testEnv(DB, BUCKET) as never
    );
    expect(corruptedGet.status).toBe(423);
    expect(
      DB.state.provenance.find(row => row.entity_id === firstAsset.id)
    ).toMatchObject({
      marking_status: "failed",
    });

    const secondAsset = await generateSpeech(DB, BUCKET);
    const secondRow = DB.state.assets.find(row => row.id === secondAsset.id);
    const secondAlternate = new Uint8Array(rawMp3);
    secondAlternate[4] ^= 0xff;
    const secondMarked = embedMediaProvenanceMarker(
      secondAlternate.buffer,
      "audio/mpeg",
      secondAsset.provenance?.marking.publicToken || ""
    );
    expect(secondMarked).not.toBeNull();
    BUCKET.overwritePreservingMetadata(
      String(secondRow?.r2_key),
      secondMarked?.bytes || new ArrayBuffer(0)
    );
    const corruptedHead = await worker.fetch(
      new Request(`https://studio.example${secondAsset.url}`, {
        method: "HEAD",
        headers: { "oai-authenticated-user-email": "creator@example.com" },
      }),
      testEnv(DB, BUCKET) as never
    );
    expect(corruptedHead.status).toBe(423);
    expect(
      DB.state.events.some(
        event =>
          event.event_type === "asset.generated-delivery-blocked" &&
          event.entity_id === secondAsset.id
      )
    ).toBe(true);
  });
});
