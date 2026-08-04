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
import {
  createEmptyWorkspace,
  type CapabilityState,
  type WorkspaceDocument,
} from "@contracts/workspace";
import { platformApi, PlatformApiError } from "@/lib/platform-api";

const EMPTY_CAPABILITIES: CapabilityState = {
  persistence: false,
  uploads: false,
  ai: false,
  analysis: false,
  transcription: false,
  speech: false,
  videoGeneration: false,
  publishing: false,
  missing: [],
  modelRoutes: [],
};

interface WorkspaceContextValue {
  workspace: WorkspaceDocument;
  capabilities: CapabilityState;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateWorkspace: (
    updater:
      WorkspaceDocument | ((current: WorkspaceDocument) => WorkspaceDocument)
  ) => Promise<WorkspaceDocument>;
  adoptWorkspace: (workspace: WorkspaceDocument) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceDocument>(() =>
    createEmptyWorkspace("creator@reelassati.local")
  );
  const [capabilities, setCapabilities] =
    useState<CapabilityState>(EMPTY_CAPABILITIES);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const currentRef = useRef(workspace);
  const saveChainRef = useRef(Promise.resolve());
  const mutationRef = useRef(0);
  const serverRevisionRef = useRef(0);
  const pendingSavesRef = useRef(0);
  const readyRef = useRef(false);
  const saveConflictRef = useRef(false);

  useEffect(() => {
    currentRef.current = workspace;
  }, [workspace]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await platformApi.workspace();
      setWorkspace(result.workspace);
      currentRef.current = result.workspace;
      serverRevisionRef.current = result.workspace.revision;
      setCapabilities(result.capabilities);
      readyRef.current = true;
      saveConflictRef.current = false;
      setReady(true);
      setSaveConflict(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load the workspace"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    platformApi
      .workspace()
      .then(result => {
        if (!active) return;
        setWorkspace(result.workspace);
        currentRef.current = result.workspace;
        serverRevisionRef.current = result.workspace.revision;
        setCapabilities(result.capabilities);
        readyRef.current = true;
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load the workspace"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      const next =
        typeof updater === "function" ? updater(currentRef.current) : updater;
      const stamped = {
        ...next,
        revision: serverRevisionRef.current,
        updatedAt: new Date().toISOString(),
      };
      const mutation = ++mutationRef.current;
      currentRef.current = stamped;
      setWorkspace(stamped);
      pendingSavesRef.current += 1;
      setSaving(true);
      setError(null);

      const save = async () => {
        try {
          const result = await platformApi.saveWorkspace({
            ...stamped,
            revision: serverRevisionRef.current,
          });
          serverRevisionRef.current = result.workspace.revision;
          if (mutation === mutationRef.current) {
            currentRef.current = result.workspace;
            setWorkspace(result.workspace);
          } else {
            currentRef.current = {
              ...currentRef.current,
              revision: result.workspace.revision,
            };
            setWorkspace(current => ({
              ...current,
              revision: result.workspace.revision,
            }));
          }
          setUnsaved(false);
          setError(null);
          return result.workspace;
        } catch (cause) {
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
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          if (pendingSavesRef.current === 0) setSaving(false);
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
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <WorkspaceContext.Provider value={value}>
      {!loading && !ready ? (
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-7 shadow-card">
            <p className="mono-eyebrow text-primary">Workspace protected</p>
            <h1 className="mt-3 text-2xl font-semibold">
              Your studio did not load.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-foreground/60">
              {error ||
                "REELassati blocked editing so an empty placeholder cannot overwrite your real workspace."}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Retry workspace
            </button>
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
