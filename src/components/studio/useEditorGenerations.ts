import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as createUuid } from "uuid";
import type { Asset, GenerationJob } from "@contracts/workspace";
import type {
  EditorGeneration,
  EditorGenerationKind,
} from "@contracts/editor-generations";
import {
  completeEditorGeneration,
  applyVideoGenerationResult,
  failEditorGeneration,
  nextEditorGeneration,
  recoverSavedEditorResults,
} from "@/lib/editor-generations";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

const running = new Set<string>();
type Executor = (
  record: EditorGeneration
) => Promise<Asset | { job: GenerationJob }>;

export function useEditorGenerations(projectId: string) {
  const { workspace, updateWorkspace } = useWorkspace();
  const current = useRef(workspace);
  current.current = workspace;
  const [checking, setChecking] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const missing = workspace.jobs.filter(
      job =>
        job.type === "video" &&
        job.projectId === projectId &&
        !(workspace.editorGenerations ?? []).some(g => g.jobId === job.id)
    );
    if (!missing.length) return;
    void updateWorkspace(w => {
      let next = w;
      for (const job of missing) {
        if (next.editorGenerations?.some(g => g.jobId === job.id)) continue;
        const record = nextEditorGeneration(
          next,
          projectId,
          "video",
          job.id,
          job.createdAt
        );
        const asset = next.assets.find(a => a.id === job.resultAssetId);
        const saved: EditorGeneration = {
          ...record,
          jobId: job.id,
          assetId: job.resultAssetId,
          name: asset?.name ?? record.name,
          status:
            job.status === "completed"
              ? "completed"
              : job.status === "failed"
                ? "failed"
                : "in_progress",
          error: job.error,
          updatedAt: job.updatedAt,
        };
        next = {
          ...next,
          editorGenerations: [...(next.editorGenerations ?? []), saved],
        };
      }
      return next;
    }).catch(() => undefined);
  }, [projectId, workspace.jobs, workspace.editorGenerations, updateWorkspace]);

  const check = useCallback(
    async (record: EditorGeneration) => {
      if (running.has(`check:${record.id}`)) return;
      running.add(`check:${record.id}`);
      setChecking(ids => [...ids, record.id]);
      setMessage("");
      try {
        if (record.kind === "video" && record.jobId) {
          const result = await platformApi.videoJob(record.jobId);
          await updateWorkspace(w =>
            applyVideoGenerationResult(w, record.id, result)
          );
        } else {
          // This only reads saved files. It never starts another paid generation.
          const result = await platformApi.workspace();
          await updateWorkspace(w =>
            recoverSavedEditorResults(w, result.workspace, record.id)
          );
          setMessage(
            "Saved files checked. Results appear here when the provider finishes; checking does not spend credits."
          );
        }
      } catch (cause) {
        setMessage(
          cause instanceof Error
            ? cause.message
            : "Could not check this generation."
        );
      } finally {
        running.delete(`check:${record.id}`);
        setChecking(ids => ids.filter(id => id !== record.id));
      }
    },
    [updateWorkspace]
  );

  const recoverVideo = useCallback(
    async (record: EditorGeneration) => {
      if (
        record.kind !== "video" ||
        !record.jobId ||
        running.has(`check:${record.id}`)
      )
        return;
      running.add(`check:${record.id}`);
      setChecking(ids => [...ids, record.id]);
      setMessage("");
      try {
        const result = await platformApi.recoverVideoJob(record.jobId);
        await updateWorkspace(w =>
          applyVideoGenerationResult(w, record.id, result)
        );
        setMessage(
          result.asset
            ? "Video recovered and saved to Library. No new generation or credit charge."
            : "Recovery started for the existing video. Its file will appear here when ready; no new generation or credit charge."
        );
      } catch (cause) {
        setMessage(
          cause instanceof Error
            ? cause.message
            : "Could not recover the existing video."
        );
      } finally {
        running.delete(`check:${record.id}`);
        setChecking(ids => ids.filter(id => id !== record.id));
      }
    },
    [updateWorkspace]
  );

  const start = async (
    kind: EditorGenerationKind,
    executor: Executor,
    count = 1
  ) => {
    setMessage("");
    const records: EditorGeneration[] = [];
    await updateWorkspace(w => {
      let next = w;
      for (let i = 0; i < Math.min(4, Math.max(1, count)); i++) {
        const record = nextEditorGeneration(
          next,
          projectId,
          kind,
          createUuid(),
          new Date().toISOString()
        );
        if (kind === "video") record.jobId = record.id;
        records.push(record);
        next = {
          ...next,
          editorGenerations: [...(next.editorGenerations ?? []), record],
        };
      }
      return next;
    });
    for (const record of records) {
      running.add(record.id);
      void (async () => {
        try {
          const result = await executor(record);
          await updateWorkspace(w =>
            "job" in result
              ? applyVideoGenerationResult(w, record.id, result)
              : completeEditorGeneration(w, record.id, result)
          );
        } catch (cause) {
          await updateWorkspace(w =>
            failEditorGeneration(
              w,
              record.id,
              cause instanceof Error ? cause.message : "Generation failed."
            )
          ).catch(() => undefined);
        } finally {
          running.delete(record.id);
        }
      })();
    }
  };

  useEffect(() => {
    let recoveryChecks = 0;
    const poll = () => {
      for (const record of current.current.editorGenerations ?? []) {
        if (
          record.projectId === projectId &&
          record.kind === "video" &&
          record.jobId &&
          ["submitting", "in_progress"].includes(record.status) &&
          !running.has(record.id)
        )
          void check(record);
      }
      const recoverable = current.current.editorGenerations?.find(
        record =>
          record.projectId === projectId &&
          record.kind !== "video" &&
          ["submitting", "in_progress"].includes(record.status) &&
          !running.has(record.id)
      );
      // Reconcile an interrupted synchronous request against saved server output.
      // Never automatically send the original paid request again.
      if (recoverable && recoveryChecks < 12) {
        recoveryChecks++;
        void check(recoverable);
      }
    };
    const first = window.setTimeout(poll, 1000);
    const timer = window.setInterval(poll, 15000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [projectId, check]);

  const rename = async (record: EditorGeneration, name: string) => {
    const cleaned = name.trim().slice(0, 240);
    if (!cleaned) return;
    if (record.assetId) await platformApi.renameAsset(record.assetId, cleaned);
    await updateWorkspace(w => {
      const latest = w.editorGenerations?.find(g => g.id === record.id);
      return {
        ...w,
        editorGenerations: w.editorGenerations?.map(g =>
          g.id === record.id ? { ...g, name: cleaned } : g
        ),
        assets: w.assets.map(a =>
          a.id === latest?.assetId ? { ...a, name: cleaned } : a
        ),
      };
    });
  };

  return {
    records: (workspace.editorGenerations ?? []).filter(
      g => g.projectId === projectId
    ),
    checking,
    message,
    start,
    check,
    recoverVideo,
    rename,
    isRunning: (id: string) => running.has(id),
  };
}
