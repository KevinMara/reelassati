import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createEmptyWorkspace,
  type CapabilityState,
  type WorkspaceDocument,
} from "@contracts/workspace";
import { captureUploadRequestScope, platformApi, PlatformApiError } from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import { WorkspaceSaveLifecycle } from "@/lib/workspace-save-lifecycle";
import { reconcileAcknowledgedWorkspace } from "@/lib/workspace-save-reconcile";
import { useAuth } from "@/hooks/useAuth";
import { rememberAuthNext, safeDashboardNext } from "@/lib/auth-next";

const EMPTY_CAPABILITIES: CapabilityState = {
  persistence: false,
  uploads: false,
  ai: false,
  analysis: false,
  transcription: false,
  speech: false,
  imageGeneration: false,
  videoGeneration: false,
  publishing: false,
  missing: [],
  modelRoutes: [],
};

interface WorkspaceContextValue {
  workspace: WorkspaceDocument;
  /** Read synchronously inside async tasks; rendered state may be one update behind. */
  getWorkspaceSnapshot: () => WorkspaceDocument;
  capabilities: CapabilityState;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateWorkspace: (
    updater:
      WorkspaceDocument | ((current: WorkspaceDocument) => WorkspaceDocument)
  ) => Promise<WorkspaceDocument>;
  adoptWorkspace: (workspace: WorkspaceDocument) => void;
  refresh: () => Promise<boolean>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { logout, user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceDocument>(() =>
    createEmptyWorkspace("creator@reelassati.local")
  );
  const [capabilities, setCapabilities] =
    useState<CapabilityState>(EMPTY_CAPABILITIES);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [openingSignIn, setOpeningSignIn] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const currentRef = useRef(workspace);
  const saveChainRef = useRef(Promise.resolve());
  const mutationRef = useRef(0);
  const serverRevisionRef = useRef(0);
  const saveLifecycle = useRef(new WorkspaceSaveLifecycle());
  const readyRef = useRef(false);
  const saveConflictRef = useRef(false);

  // Every mutation below writes this ref before publishing React state. Never
  // mirror an older render back into it: in-flight editing reads the latest ref.
  const getWorkspaceSnapshot = useCallback(() => currentRef.current, []);

  const refresh = useCallback(async () => {
    const epoch = saveLifecycle.current.reset();
    readyRef.current = false;
    setReady(false);
    setSaving(false);
    setLoading(true);
    setError(null);
    setAuthenticationRequired(false);
    try {
      const scope = await captureUploadRequestScope();
      if (!saveLifecycle.current.current(epoch)) return false;
      const result = await platformApi.workspace(scope);
      if (!saveLifecycle.current.current(epoch)) return false;
      mutationRef.current += 1;
      setWorkspace(result.workspace);
      currentRef.current = result.workspace;
      serverRevisionRef.current = result.workspace.revision;
      setCapabilities(result.capabilities);
      readyRef.current = true;
      saveConflictRef.current = false;
      setReady(true);
      setSaveConflict(false);
      setUnsaved(false);
      return true;
    } catch (cause) {
      if (!saveLifecycle.current.current(epoch)) return false;
      setAuthenticationRequired(
        cause instanceof PlatformApiError && cause.status === 401
      );
      setError(
        cause instanceof Error ? cause.message : "Could not load the workspace"
      );
      return false;
    } finally {
      if (saveLifecycle.current.current(epoch)) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    const lifecycle = saveLifecycle.current;
    return () => {
      active = false;
      lifecycle.reset();
      readyRef.current = false;
    };
  }, [authLoading, user?.id, refresh]);

  const updateWorkspace = useCallback(
    async (
      updater:
        WorkspaceDocument | ((current: WorkspaceDocument) => WorkspaceDocument)
    ) => {
      if (!readyRef.current) {
        throw new Error(
          "The workspace has not loaded, so changes are blocked."
        );
      }
      if (saveConflictRef.current) {
        throw new Error(
          "A newer server copy exists. Download a backup, then reload before editing."
        );
      }
      const ownerEmail = currentRef.current.profile.email.toLowerCase();
      const brandId = selectedBrand(ownerEmail);
      // Start authentication now, while keeping optimistic mutations ordered.
      // Resolve failures as values until this save reaches the queue head.
      const scopeResult = captureUploadRequestScope().then(
        scope => ({ scope, error: null }),
        error => ({ scope: null, error })
      );
      const next =
        typeof updater === "function" ? updater(currentRef.current) : updater;
      const stamped = {
        ...next,
        revision: serverRevisionRef.current,
        updatedAt: new Date().toISOString(),
      };
      const mutation = ++mutationRef.current;
      const epoch = saveLifecycle.current.begin();
      const ownsContext = () => saveLifecycle.current.current(epoch) &&
        currentRef.current.profile.email.toLowerCase() === ownerEmail &&
        selectedBrand(ownerEmail) === brandId;
      currentRef.current = stamped;
      setWorkspace(stamped);
      setSaving(true);
      setError(null);

      const save = async () => {
        try {
          const captured = await scopeResult;
          if (!ownsContext()) throw new Error("The workspace changed before this save could run. No newer workspace was modified.");
          if (!captured.scope) throw captured.error;
          if (captured.scope.ownerEmail !== ownerEmail || captured.scope.brandId !== brandId)
            throw new Error("Your account or brand changed before saving. Reload the intended workspace before editing.");
          const result = await platformApi.saveWorkspace({
            ...stamped,
            revision: serverRevisionRef.current,
          }, captured.scope);
          if (!ownsContext()) return result.workspace;
          serverRevisionRef.current = result.workspace.revision;
          const reconciled = reconcileAcknowledgedWorkspace(
            currentRef.current,
            result.workspace,
            mutation,
            mutationRef.current
          );
          currentRef.current = reconciled;
          setWorkspace(reconciled);
          setUnsaved(false);
          setError(null);
          return result.workspace;
        } catch (cause) {
          if (!ownsContext()) throw cause;
          if (cause instanceof PlatformApiError && cause.status === 409) {
            saveConflictRef.current = true;
            setSaveConflict(true);
          }
          setUnsaved(true);
          setError(
            cause instanceof Error
              ? cause.message
              : "Changes could not be saved"
          );
          throw cause;
        } finally {
          if (saveLifecycle.current.finish(epoch) === true) setSaving(false);
        }
      };

      const queuedSave = saveChainRef.current.then(save, save);
      saveChainRef.current = queuedSave.then(
        () => undefined,
        () => undefined
      );
      return queuedSave;
    },
    []
  );

  const adoptWorkspace = useCallback((next: WorkspaceDocument) => {
    saveLifecycle.current.reset();
    setSaving(false);
    mutationRef.current += 1;
    serverRevisionRef.current = next.revision;
    currentRef.current = next;
    readyRef.current = true;
    saveConflictRef.current = false;
    setWorkspace(next);
    setReady(true);
    setSaveConflict(false);
    setUnsaved(false);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      workspace,
      getWorkspaceSnapshot,
      capabilities,
      loading,
      saving,
      error,
      updateWorkspace,
      adoptWorkspace,
      refresh,
    }),
    [
      workspace,
      getWorkspaceSnapshot,
      capabilities,
      loading,
      saving,
      error,
      updateWorkspace,
      adoptWorkspace,
      refresh,
    ]
  );

  const downloadBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(currentRef.current, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reelassati-workspace-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  const openSignIn = useCallback(async () => {
    const next = safeDashboardNext(`${location.pathname}${location.search}`);
    rememberAuthNext(next);
    setOpeningSignIn(true);
    try {
      await logout();
    } catch {
      // The local auth state is cleared by logout's finally block even when
      // the remote session is already invalid.
    } finally {
      navigate(`/auth/login?next=${encodeURIComponent(next)}`, {
        replace: true,
      });
    }
  }, [location.pathname, location.search, logout, navigate]);

  return (
    <WorkspaceContext.Provider value={value}>
      {!loading && !ready ? (
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-7 shadow-card">
            <p className="mono-eyebrow text-primary">
              {authenticationRequired
                ? "Sign-in required"
                : "Workspace protected"}
            </p>
            <h1 className="mt-3 text-2xl font-semibold">
              {authenticationRequired
                ? "Your session has expired."
                : "Your studio did not load."}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-foreground/60">
              {authenticationRequired
                ? "Sign in again to reopen this exact page. Your workspace and media are safe."
                : error ||
                  "REELassati blocked editing so an empty placeholder cannot overwrite your real workspace."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {authenticationRequired ? (
                <button
                  type="button"
                  onClick={() => void openSignIn()}
                  disabled={openingSignIn}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                >
                  {openingSignIn ? "Opening sign in…" : "Sign in"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading || openingSignIn}
                className={`${
                  authenticationRequired
                    ? "border border-border bg-background text-foreground hover:border-primary/40"
                    : "bg-primary text-white hover:bg-primary-hover"
                } rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60`}
              >
                Try again
              </button>
            </div>
          </section>
        </main>
      ) : (
        children
      )}
      {ready && (saveConflict || unsaved) ? (
        <aside
          role="alert"
          className="fixed bottom-4 right-4 z-[10000] w-[min(420px,calc(100vw-2rem))] rounded-xl border border-amber-500/30 bg-background p-4 shadow-xl"
        >
          <p className="text-sm font-semibold">
            {saveConflict
              ? "A newer workspace copy exists."
              : "Some visible changes are not saved."}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/60">
            {saveConflict
              ? "Editing is paused to prevent an overwrite. Save your visible copy, then load the server version."
              : error ||
                "Download a backup or retry the durable workspace save."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadBackup}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium"
            >
              Download local backup
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                saveConflict ? "bg-primary text-white" : "border border-border"
              }`}
            >
              {saveConflict ? "Reload server copy" : "Reload server copy"}
            </button>
            {!saveConflict ? (
              <button
                type="button"
                onClick={() => void updateWorkspace(currentRef.current)}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white"
              >
                Retry save
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
