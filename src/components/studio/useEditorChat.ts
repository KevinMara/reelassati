import {
  applyChatCatalogAudio,
  resolveChatCatalogAudio,
} from "@/lib/editor-chat-catalog-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import type {
  Asset,
  EditProject,
  WorkspaceDocument,
} from "@contracts/workspace";
import type {
  EditorChatAction,
  EditorChatMessage,
  EditorChatReference,
  EditorChatState,
} from "@contracts/editor-chat";
import { AI_CREDIT_COSTS } from "@contracts/billing";
import {
  editorChatRunStatus,
  editorChatCanExecute,
  type EditorChatRequest,
} from "@contracts/editor-chat";
import { normalizeEditorChatState } from "@contracts/editor-chat-state";
import { normalizeReview } from "@contracts/source-review";
import { useWorkspace } from "@/providers/workspace";
import { platformApi } from "@/lib/platform-api";
import {
  applyChatAction,
  canRunChatAction,
  insertChatAsset,
  mapChatTranscript,
  recordChatEdit,
} from "@/lib/editor-chat-execution";
import {
  applyVideoGenerationResult,
  completeEditorGeneration,
  failEditorGeneration,
  nextEditorGeneration,
  recoverSavedEditorResults,
} from "@/lib/editor-generations";
import { resolveMediaDuration } from "@/lib/media-metadata";
import { validateFileSelection } from "@/lib/file-validation";
import {
  applyChatCompletion,
  changeChatScopeDecision,
  mergeChatTranscript,
} from "@/lib/editor-chat-safety";

import {
  prepareChatReplanRequest,
  mergeChatReplan,
  recoverChatTranscripts,
} from "@/lib/editor-chat-recovery";

const DEFAULT_CHAT: EditorChatState = {
  mode: "ask",
  maxCredits: 200,
  preferencesVersion: 2,
  messages: [],
};
const activeProjects = new Set<string>();

export function useEditorChat(
  project: EditProject,
  { onSeek }: { onSeek: (time: number) => void }
) {
  const { workspace, updateWorkspace, getWorkspaceSnapshot } = useWorkspace();
  const stopRequested = useRef(false);
  const resultChecks = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const state = useMemo(
    () => normalizeEditorChatState(project.editorChat) ?? DEFAULT_CHAT,
    [project.editorChat]
  );
  const getProject = () => {
    const p = getWorkspaceSnapshot().projects.find(p => p.id === project.id);
    if (!p) throw new Error("This project is no longer available.");
    return p;
  };
  const getMessage = (id: string) => {
    const message = getProject().editorChat?.messages.find(m => m.id === id);
    if (!message) throw new Error("The saved chat action could not be found.");
    return message;
  };
  async function save(transform: (w: WorkspaceDocument) => WorkspaceDocument) {
    // The provider owns the only optimistic snapshot and mutation counter.
    // A returned durable response may be older than a concurrent manual edit.
    return updateWorkspace(transform);
  }
  async function changeChat(
    transform: (state: EditorChatState) => EditorChatState
  ) {
    return save(w => ({
      ...w,
      projects: w.projects.map(p =>
        p.id === project.id
          ? {
              ...p,
              editorChat: transform(
                normalizeEditorChatState(p.editorChat) ?? DEFAULT_CHAT
              ),
            }
          : p
      ),
    }));
  }
  async function changeMessage(
    id: string,
    transform: (m: EditorChatMessage) => EditorChatMessage
  ) {
    return changeChat(s => ({
      ...s,
      messages: s.messages.map(m => (m.id === id ? transform(m) : m)),
    }));
  }
  async function changeAction(
    messageId: string,
    actionId: string,
    transform: (action: EditorChatAction) => EditorChatAction
  ) {
    return changeMessage(messageId, m => ({
      ...m,
      plan: m.plan
        ? {
            ...m.plan,
            actions: m.plan.actions.map(a =>
              a.id === actionId ? transform(a) : a
            ),
          }
        : undefined,
    }));
  }
  const progress = (messageId: string, actionId: string, detail: string) =>
    changeAction(messageId, actionId, a => ({
      ...a,
      runtime: { ...a.runtime, detail },
    }));

  useEffect(() => {
    stopRequested.current = false;
    return () => {
      stopRequested.current = true;
    };
  }, [project.id]);

  useEffect(() => {
    if (busy || activeProjects.has(project.id)) return;
    const message = state.messages.find(m =>
      m.plan?.actions.some(
        a =>
          a.kind === "generate" &&
          a.status === "interrupted" &&
          getWorkspaceSnapshot().editorGenerations?.some(
            g => g.id === a.runtime?.generationId && g.status === "completed"
          )
      )
    );
    const action = message?.plan?.actions.find(
      a =>
        a.kind === "generate" &&
        a.status === "interrupted" &&
        getWorkspaceSnapshot().editorGenerations?.some(
          g => g.id === a.runtime?.generationId && g.status === "completed"
        )
    );
    if (!message || !action || resultChecks.current.has(action.id)) return;
    resultChecks.current.add(action.id);
    void recover(message.id, action.id)
      .then(async () => {
        if (message.status !== "stopped" && !stopRequested.current)
          await run(message.id);
      })
      .finally(() => resultChecks.current.delete(action.id));
    // A generation completion is a read-only recovery signal, never a new paid generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.editorGenerations, state.messages, busy, project.id]);

  // A re-opened tab reads saved results; it never silently repeats a paid request.
  useEffect(() => {
    if (activeProjects.has(project.id)) return;
    const interrupted = state.messages.some(
      m =>
        m.status === "planning" ||
        m.status === "running" ||
        m.plan?.actions.some(a => a.status === "running")
    );
    if (!interrupted) return;
    void changeChat(s => ({
      ...s,
      messages: s.messages.map(m => ({
        ...m,
        status: ["planning", "running"].includes(m.status ?? "")
          ? "stopped"
          : m.status,
        text:
          m.status === "planning"
            ? "Planning was interrupted. Resume to check the same saved request; it will not start a second paid plan."
            : m.text,
        plan: m.plan
          ? {
              ...m.plan,
              actions: m.plan.actions.map(a =>
                a.status === "running"
                  ? {
                      ...a,
                      status: "interrupted",
                      runtime: {
                        ...a.runtime,
                        detail:
                          "Connection interrupted. Check saved results before continuing.",
                      },
                    }
                  : a
              ),
            }
          : undefined,
      })),
    })).catch(cause => setError(String(cause)));
    // Run once for this mounted project. Changes while this hook owns a run are intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function finishAction(
    messageId: string,
    action: EditorChatAction,
    transform?: (p: EditProject, w: WorkspaceDocument) => EditProject,
    detail = "Saved",
    timelineMutation = Boolean(transform)
  ) {
    await save(w => ({
      ...w,
      projects: w.projects.map(p => {
        if (p.id !== project.id) return p;
        return applyChatCompletion(p, messageId, action.id, {
          detail,
          timelineMutation,
          transform: transform ? value => transform(value, w) : undefined,
        });
      }),
    }));
  }

  async function execute(messageId: string, action: EditorChatAction) {
    if (
      ["edit", "insert", "settings", "history", "seek", "story-beats"].includes(
        action.kind
      )
    ) {
      await finishAction(
        messageId,
        action,
        (p, w) => applyChatAction(p, action, w.assets),
        action.kind === "seek" ? "Playhead moved" : "Timeline updated"
      );
      if (action.kind === "seek") onSeek(action.time);
      return;
    }
    if (action.kind === "analyze") {
      const assetId = action.assetId;
      const asset = assetId
        ? getWorkspaceSnapshot().assets.find(a => a.id === assetId)
        : undefined;
      if (assetId && !asset)
        throw new Error("The source video is no longer available.");
      const result = asset
        ? await (
            await import("@/lib/analyze-media")
          ).analyzeMedia(asset, getProject().platform, action.focus, detail => {
            void progress(messageId, action.id, detail).catch(() => undefined);
          })
        : await platformApi.analyzeVideo({
            publicUrl: action.publicUrl,
            platform: getProject().platform,
            sourceRightsConfirmed: true,
            focus: action.focus,
          });
      await changeAction(messageId, action.id, a => ({
        ...a,
        runtime: { ...a.runtime, result: JSON.stringify(result) },
      }));
      await finishAction(
        messageId,
        action,
        assetId
          ? p => ({
              ...p,
              sourceReviews: [
                ...(p.sourceReviews ?? []).filter(r => r.assetId !== assetId),
                {
                  assetId,
                  reviewedAt: new Date().toISOString(),
                  summary: result.summary,
                  ...normalizeReview(result.review),
                  moments: result.retention,
                },
              ],
            })
          : undefined,
        result.summary,
        false
      );
      return;
    }
    if (action.kind === "transcribe") {
      const { transcribeMedia } = await import("@/lib/transcribe-media");
      const results: Array<{
        assetId: string;
        segments: EditProject["transcript"];
        provenance?: EditProject["transcriptProvenance"];
      }> = [];
      for (const assetId of action.assetIds) {
        const asset = getWorkspaceSnapshot().assets.find(a => a.id === assetId);
        if (!asset) throw new Error("The source file is no longer available.");
        const result = await transcribeMedia(
          asset,
          action.language ?? getWorkspaceSnapshot().profile.contentLanguage,
          project.id,
          detail => {
            void progress(messageId, action.id, detail).catch(() => undefined);
          }
        );
        results.push({ assetId, ...result });
        await changeAction(messageId, action.id, a => ({
          ...a,
          runtime: { ...a.runtime, result: JSON.stringify(results) },
        }));
      }
      await changeAction(messageId, action.id, a => ({
        ...a,
        runtime: { ...a.runtime, result: JSON.stringify(results) },
      }));
      const range = getMessage(messageId).range;
      await finishAction(
        messageId,
        action,
        p => {
          const mapped = results.flatMap(r =>
            mapChatTranscript(p, r.assetId, r.segments)
          );
          const next = {
            ...p,
            transcript: mergeChatTranscript(p, mapped, action.replace, range),
            transcriptProvenance:
              results.length === 1 ? results[0].provenance : undefined,
          };
          return recordChatEdit(p, next, action.id, action.label);
        },
        results.some(r => r.segments.length)
          ? "Captions added to the timeline"
          : "No speech was detected; no captions added"
      );
      return;
    }
    if (action.kind === "catalog-audio") {
      await progress(messageId, action.id, "Preparing the free catalog sound…");
      const asset = await resolveChatCatalogAudio(
        action.catalogId,
        getWorkspaceSnapshot().assets,
        file => platformApi.uploadAsset(file, "audio")
      );
      await save(w => ({
        ...w,
        assets: [asset, ...w.assets.filter(item => item.id !== asset.id)],
      }));
      await changeAction(messageId, action.id, a => ({
        ...a,
        runtime: { ...a.runtime, assetId: asset.id },
      }));
      if (
        action.insert &&
        getMessage(messageId).plan?.projectUpdatedAt !== getProject().updatedAt
      ) {
        await changeAction(messageId, action.id, a => ({
          ...a,
          status: "blocked",
          error:
            "The timeline changed while the sound loaded. It is saved in Library; ask Reel where to place it in your latest edit.",
        }));
        return;
      }
      await finishAction(
        messageId,
        action,
        action.insert
          ? p => applyChatCatalogAudio(p, asset, action)
          : undefined,
        action.insert
          ? "Free sound saved to Library and placed on the timeline · 0 audio credits"
          : "Free sound saved to Library · 0 audio credits"
      );
      return;
    }
    if (action.kind === "generate") {
      // The action identity survives reloads and is shared across open tabs.
      const id = action.id;
      const media = action.media === "speech" ? "voice" : action.media;
      await save(w => {
        const record =
          w.editorGenerations?.find(item => item.id === id) ??
          nextEditorGeneration(
            w,
            project.id,
            media,
            id,
            new Date().toISOString()
          );
        if (!w.editorGenerations?.some(item => item.id === id)) {
          record.name = action.name;
          record.outputName = `${action.name} ${id.slice(0, 8)}`;
          if (media === "video") record.jobId = id;
        }
        return {
          ...w,
          editorGenerations: [
            ...(w.editorGenerations ?? []).filter(item => item.id !== id),
            record,
          ],
          projects: w.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  editorChat: {
                    ...(p.editorChat ?? DEFAULT_CHAT),
                    messages: (p.editorChat?.messages ?? []).map(m =>
                      m.id === messageId && m.plan
                        ? {
                            ...m,
                            plan: {
                              ...m.plan,
                              actions: m.plan.actions.map(a =>
                                a.id === action.id
                                  ? {
                                      ...a,
                                      runtime: {
                                        ...a.runtime,
                                        generationId: id,
                                        ...(media === "video"
                                          ? { jobId: id }
                                          : {}),
                                      },
                                    }
                                  : a
                              ),
                            },
                          }
                        : m
                    ),
                  },
                }
              : p
          ),
        };
      });
      const record = getWorkspaceSnapshot().editorGenerations!.find(
        g => g.id === id
      )!;
      let asset: Asset;
      try {
        if (action.media === "video") {
          const created = await platformApi.createVideo({
            requestId: id,
            assetName: record.outputName,
            prompt: action.prompt,
            duration: action.seconds ?? 5,
            resolution: "720p",
            generateAudio: false,
            aspectRatio: getProject().aspectRatio,
            projectId: project.id,
            rightsConfirmed: true,
            referenceContainsRealPerson: false,
            realPersonConsentConfirmed: false,
          });
          await save(w => applyVideoGenerationResult(w, id, created));
          await changeAction(messageId, action.id, a => ({
            ...a,
            runtime: {
              ...a.runtime,
              jobId: created.job.id,
              detail:
                "Video is generating. You can keep editing; check its saved result here or in Library.",
            },
          }));
          // Poll without blocking other independent requested edits or regenerating on reload.
          await changeAction(messageId, action.id, a => ({
            ...a,
            status: "interrupted",
          }));
          return;
        } else if (action.media === "image") {
          asset = await platformApi.generateImage({
            requestId: id,
            prompt: action.prompt,
            assetName: record.outputName,
            aspectRatio: getProject().aspectRatio,
            resolution: "1K",
            rightsConfirmed: true,
            referenceContainsRealPerson: false,
            realPersonConsentConfirmed: false,
          });
        } else if (action.media === "speech") {
          asset = await platformApi.synthesizeSpeech({
            requestId: id,
            text: action.prompt,
            voice: action.voice ?? "English_Graceful_Lady",
            assetName: record.outputName,
            projectId: project.id,
            rightsConfirmed: true,
          });
        } else {
          const quote = await platformApi.quoteAudio(
            action.media,
            action.seconds ?? 15
          );
          if (quote.credits > action.credits)
            throw new Error(
              "The audio price changed. Request a fresh quote before generating."
            );
          asset = await platformApi.generateAudio({
            kind: action.media,
            text: action.prompt,
            seconds: action.seconds ?? 15,
            acceptedCredits: quote.credits,
            requestId: id,
            assetName: record.outputName,
            projectId: project.id,
            rightsConfirmed: true,
          });
        }
        if (asset.kind !== "image" && !asset.duration)
          asset = { ...asset, duration: await resolveMediaDuration(asset) };
        await save(w => completeEditorGeneration(w, id, asset));
        await changeAction(messageId, action.id, a => ({
          ...a,
          runtime: { ...a.runtime, assetId: asset.id },
        }));
        await finishAction(
          messageId,
          action,
          action.insert
            ? p =>
                recordChatEdit(
                  p,
                  insertChatAsset(
                    p,
                    asset,
                    action.id,
                    action.insert!.start,
                    action.insert!.duration
                  ),
                  action.id,
                  action.label
                )
            : undefined,
          action.insert
            ? "File saved to Library and placed on the timeline"
            : "File saved to Library. Drag it wherever you need it."
        );
      } catch (cause) {
        await save(w =>
          failEditorGeneration(
            w,
            id,
            cause instanceof Error ? cause.message : "Generation failed"
          )
        ).catch(() => undefined);
        throw cause;
      }
      return;
    }
    if (action.kind === "replan") {
      const parent = getMessage(messageId);
      const liveAction =
        parent.plan?.actions.find(step => step.id === action.id) || action;
      const savedRequest = prepareChatReplanRequest(
        parent,
        liveAction,
        project.id,
        uuid()
      );
      if (!liveAction.runtime?.request) {
        await changeAction(messageId, action.id, step => ({
          ...step,
          runtime: { ...step.runtime, request: savedRequest },
        }));
      }
      const response = await platformApi.editorChat(savedRequest);
      await changeMessage(messageId, message =>
        mergeChatReplan(message, action.id, response)
      );
      return;
    }
    throw new Error("This action is not supported by the current editor.");
  }

  async function run(messageId: string) {
    if (activeProjects.has(project.id)) return;
    const pendingPlan = getMessage(messageId);
    if (!editorChatCanExecute(pendingPlan)) return;
    activeProjects.add(project.id);
    stopRequested.current = false;
    setBusy(true);
    setError("");
    try {
      await changeMessage(messageId, m => ({ ...m, status: "running" }));
      for (let pass = 0; pass < 100; pass++) {
        if (stopRequested.current) break;
        const m = getMessage(messageId);
        const actions = m.plan?.actions ?? [];
        const remaining = (m.maxCredits ?? 200) - (m.usedCredits ?? 5);
        const action = actions.find(a =>
          canRunChatAction(a, actions, m.mode ?? "ask", remaining)
        );
        if (!action) break;
        // A manual change made while Reel was thinking must not be overwritten.
        if (
          ([
            "edit",
            "insert",
            "settings",
            "history",
            "transcribe",
            "story-beats",
          ].includes(action.kind) ||
            (action.kind === "catalog-audio" && action.insert)) &&
          m.plan?.projectUpdatedAt !== getProject().updatedAt
        ) {
          await changeAction(messageId, action.id, a => ({
            ...a,
            status: "blocked",
            error:
              "The timeline changed since this plan. Send a new instruction so Reel can use your latest edit.",
          }));
          continue;
        }
        await changeMessage(messageId, item => ({
          ...item,
          usedCredits: (item.usedCredits ?? 5) + action.credits,
          plan: item.plan
            ? {
                ...item.plan,
                actions: item.plan.actions.map(a =>
                  a.id === action.id
                    ? {
                        ...a,
                        status: "running",
                        runtime: {
                          ...a.runtime,
                          startedAt: new Date().toISOString(),
                          detail: a.label,
                        },
                      }
                    : a
                ),
              }
            : undefined,
        }));
        try {
          await execute(messageId, action);
        } catch (cause) {
          await changeAction(messageId, action.id, a => ({
            ...a,
            status: "failed",
            error:
              cause instanceof Error ? cause.message : "This action failed.",
          }));
        }
      }
      await changeMessage(messageId, m => {
        const actions = (m.plan?.actions ?? []).map(a => {
          if (
            a.status === "pending" &&
            a.dependsOn.some(id =>
              m.plan?.actions.some(
                dep =>
                  dep.id === id &&
                  ["failed", "blocked", "skipped"].includes(dep.status)
              )
            )
          )
            return {
              ...a,
              status: "blocked" as const,
              error:
                "A prerequisite did not finish. Describe a new plan or recover its saved result.",
            };
          return a.status === "pending" &&
            a.scope === "extra" &&
            m.mode !== "auto" &&
            !a.runtime?.approved
            ? { ...a, status: "awaiting-approval" as const }
            : a;
        });
        return {
          ...m,
          status: editorChatRunStatus(
            actions,
            m.plan?.blockedReasons ?? [],
            stopRequested.current
          ),
          plan: m.plan ? { ...m.plan, actions } : undefined,
        };
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Reel could not save this action."
      );
    } finally {
      activeProjects.delete(project.id);
      setBusy(false);
    }
  }

  async function send(
    prompt: string,
    references: EditorChatReference[] = [],
    range?: { start: number; end: number },
    selectedClipIds: string[] = [],
    options: Pick<EditorChatRequest, "executionMode" | "taskPreset"> = {}
  ) {
    if (!prompt.trim() || activeProjects.has(project.id)) return;
    activeProjects.add(project.id);
    setBusy(true);
    setError("");
    stopRequested.current = false;
    const id = uuid();
    const assistantId = `${id}-reel`;
    try {
      const settings =
        normalizeEditorChatState(getProject().editorChat) ?? DEFAULT_CHAT;
      const history = settings.messages
        .filter(m => m.text)
        .slice(-12)
        .map(m => ({ role: m.role, text: m.text.slice(0, 2000) }));
      const request = {
        ...options,
        requestId: id,
        projectId: project.id,
        prompt: prompt.trim(),
        mode: settings.mode,
        maxCredits: settings.maxCredits,
        references,
        history,
        range,
        selectedClipIds,
      };
      await changeChat(s => ({
        ...s,
        messages: [
          ...s.messages,
          {
            id,
            requestId: id,
            role: "user",
            text: prompt.trim(),
            createdAt: new Date().toISOString(),
            references,
            request,
          },
          {
            id: assistantId,
            requestId: id,
            role: "assistant",
            text: "Reading your project and planning the requested changes…",
            createdAt: new Date().toISOString(),
            status: "planning",
            mode: settings.mode,
            maxCredits: settings.maxCredits,
            usedCredits: AI_CREDIT_COSTS.editPlan,
            range,
            selectedClipIds,
            references,
            request,
          },
        ].slice(-60) as EditorChatMessage[],
      }));
      const response = await platformApi.editorChat(request);
      await changeMessage(assistantId, m => ({
        ...m,
        text: response.message,
        plan: response,
        status: "ready",
      }));
    } catch (cause) {
      const detail =
        cause instanceof Error ? cause.message : "Planning could not finish.";
      setError(detail);
      await changeMessage(assistantId, m => ({
        ...m,
        text: detail,
        status: "failed",
      })).catch(() => undefined);
    } finally {
      activeProjects.delete(project.id);
      setBusy(false);
    }
    if (
      getWorkspaceSnapshot()
        .projects.find(p => p.id === project.id)
        ?.editorChat?.messages.find(m => m.id === assistantId)?.plan &&
      !stopRequested.current &&
      options.executionMode !== "plan"
    )
      await run(assistantId);
  }

  async function recover(messageId: string, actionId: string) {
    if (busy || activeProjects.has(project.id)) return;
    const freeSound = getMessage(messageId).plan?.actions.find(
      action => action.id === actionId
    );
    if (
      freeSound?.kind === "catalog-audio" &&
      ["failed", "interrupted"].includes(freeSound.status)
    ) {
      activeProjects.add(project.id);
      setBusy(true);
      setError("");
      try {
        await changeAction(messageId, actionId, action => ({
          ...action,
          status: "pending",
          error: undefined,
        }));
        activeProjects.delete(project.id);
        await run(messageId);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not retry this free sound."
        );
      } finally {
        activeProjects.delete(project.id);
        setBusy(false);
      }
      return;
    }
    activeProjects.add(project.id);
    setBusy(true);
    setError("");
    try {
      const action = getMessage(messageId).plan?.actions.find(
        a => a.id === actionId
      );
      if (action?.kind === "replan") {
        if (!action.runtime?.request)
          throw new Error(
            "The follow-up request was not saved. Send a new instruction; no paid plan was repeated."
          );
        const response = await platformApi.editorChat(action.runtime.request);
        await changeMessage(messageId, message => ({
          ...mergeChatReplan(message, action.id, response),
          status: "stopped",
        }));
        return;
      }
      if (action?.kind === "transcribe") {
        await save(workspace => ({
          ...workspace,
          projects: workspace.projects.map(projectValue =>
            projectValue.id === project.id
              ? recoverChatTranscripts(projectValue, messageId, actionId)
              : projectValue
          ),
        }));
        return;
      }
      if (
        !action ||
        action.kind !== "generate" ||
        !action.runtime?.generationId
      )
        throw new Error(
          "No saved generation to recover. This paid request will not be repeated automatically."
        );
      const id = action.runtime.generationId;
      const alreadyReady = getWorkspaceSnapshot().editorGenerations?.some(
        g => g.id === id && g.status === "completed"
      );
      if (alreadyReady) {
        /* The generation tray already reconciled this output. */
      } else if (action.runtime.jobId) {
        let result = await platformApi.videoJob(action.runtime.jobId);
        if (result.job.status === "failed" && result.job.canRecover)
          result = await platformApi.recoverVideoJob(action.runtime.jobId);
        await save(w => applyVideoGenerationResult(w, id, result));
      } else {
        const result = await platformApi.workspace();
        await save(w => recoverSavedEditorResults(w, result.workspace, id));
      }
      const record = getWorkspaceSnapshot().editorGenerations?.find(
        g => g.id === id
      );
      const asset = getWorkspaceSnapshot().assets.find(
        a => a.id === record?.assetId
      );
      if (!asset) {
        await progress(
          messageId,
          actionId,
          record?.error ||
            "No completed result yet. Checking does not start or charge another generation."
        );
        return;
      }
      await changeAction(messageId, actionId, a => ({
        ...a,
        runtime: { ...a.runtime, assetId: asset.id },
      }));
      // Placement is explicit, but the current timeline may have changed during generation.
      const unchanged =
        getMessage(messageId).plan?.projectUpdatedAt === getProject().updatedAt;
      await finishAction(
        messageId,
        action,
        action.insert && unchanged
          ? p =>
              recordChatEdit(
                p,
                insertChatAsset(
                  p,
                  asset,
                  action.id,
                  action.insert!.start,
                  action.insert!.duration
                ),
                action.id,
                action.label
              )
          : undefined,
        action.insert && unchanged
          ? "Generated file saved and added to the timeline"
          : "Generated file is ready in Library. Drag it onto the current timeline."
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not check the saved result."
      );
    } finally {
      activeProjects.delete(project.id);
      setBusy(false);
    }
  }

  async function resume(messageId: string, newCap?: number, applyPlan = false) {
    if (busy || activeProjects.has(project.id)) return;
    if (newCap !== undefined)
      await changeMessage(messageId, m => ({
        ...m,
        maxCredits: Math.max(5, Math.min(100000, Math.floor(newCap))),
      }));
    const m = getMessage(messageId);
    if (!m.plan) {
      if (!m.request) {
        setError(
          "The saved planning request is unavailable. Describe the edit again to request a new plan."
        );
        return;
      }
      activeProjects.add(project.id);
      setBusy(true);
      try {
        const response = await platformApi.editorChat(m.request);
        await changeMessage(messageId, item => ({
          ...item,
          plan: response,
          text: response.message,
          status: "ready",
        }));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The saved plan is unavailable."
        );
        return;
      } finally {
        activeProjects.delete(project.id);
        setBusy(false);
      }
    }
    if (m.request?.executionMode === "plan" && !m.planApproved) {
      if (!applyPlan || !m.plan) return;
      await changeMessage(messageId, item => ({ ...item, planApproved: true }));
    }
    await run(messageId);
  }
  async function approve(messageId: string, actionId: string) {
    if (activeProjects.has(project.id)) return;
    await changeAction(messageId, actionId, a =>
      changeChatScopeDecision(a, "approve")
    );
    await run(messageId);
  }
  async function skip(messageId: string, actionId: string) {
    if (activeProjects.has(project.id)) return;
    await changeAction(messageId, actionId, a =>
      changeChatScopeDecision(a, "skip")
    );
    await run(messageId);
  }
  async function reviewSavedSuggestion(operationId: string, accept: boolean) {
    if (busy || activeProjects.has(project.id)) return;
    await save(w => ({
      ...w,
      projects: w.projects.map(p => {
        if (p.id !== project.id) return p;
        const operation = p.proposedChanges.find(
          item => item.id === operationId && item.status === "proposed"
        );
        if (!operation) return p;
        if (!accept)
          return {
            ...p,
            proposedChanges: p.proposedChanges.map(item =>
              item.id === operationId
                ? {
                    ...item,
                    status: "rejected" as const,
                    reviewedAt: new Date().toISOString(),
                  }
                : item
            ),
          };
        return applyChatAction(
          p,
          {
            id: `saved-${operation.id}`,
            kind: "edit",
            operation,
            label: operation.label,
            reason: operation.reason,
            requestExcerpt: "Apply saved suggestion",
            scope: "requested",
            credits: 0,
            dependsOn: [],
            status: "pending",
          },
          w.assets
        );
      }),
    }));
  }

  async function attachFiles(files: File[]): Promise<EditorChatReference[]> {
    const references: EditorChatReference[] = [];
    if (files.length > 8) throw new Error("Attach up to 8 files at a time.");
    for (const file of files) {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const { readPdfReference } = await import("@/lib/pdf-reference");
        const reference = await readPdfReference(file);
        references.push({ name: reference.name, text: reference.text });
        continue;
      }
      if (/\.(txt|md|csv|json|srt|vtt)$/i.test(file.name)) {
        if (file.size > 200000)
          throw new Error(`${file.name}: keep text references under 200 KB.`);
        const text = await file.text();
        if (text.length > 16000)
          throw new Error(
            `${file.name}: use a text reference under 16,000 characters.`
          );
        references.push({ name: file.name, text });
        continue;
      }
      const validation = validateFileSelection([file], { purpose: "media" });
      if (validation.error)
        throw new Error(
          `${file.name}: attach video, image, audio, PDF, or text.`
        );
      const kind = file.type.startsWith("audio/")
        ? "audio"
        : file.type.startsWith("image/")
          ? "image"
          : "video";
      let asset = await platformApi.uploadAsset(file, kind);
      if (kind !== "image")
        asset = { ...asset, duration: await resolveMediaDuration(asset) };
      await save(w => ({
        ...w,
        assets: [asset, ...w.assets.filter(a => a.id !== asset.id)],
      }));
      references.push({ assetId: asset.id });
    }
    return references;
  }
  return {
    state,
    busy,
    error,
    send,
    approve,
    skip,
    resume,
    recover,
    attachFiles,
    reviewSavedSuggestion,
    stop: () => {
      stopRequested.current = true;
    },
    setPreferences: async (
      patch: Partial<Pick<EditorChatState, "mode" | "maxCredits">>
    ) => {
      await changeChat(s => ({ ...s, ...patch, preferencesVersion: 2 }));
    },
  };
}
