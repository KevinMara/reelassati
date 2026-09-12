import { useState } from "react";
import { AI_CREDIT_COSTS, timedCreditCost } from "@contracts/billing";
import { useWorkspace } from "@/providers/workspace";
import { platformApi } from "@/lib/platform-api";
import { resolveMediaDuration } from "@/lib/media-metadata";
import { validateFileSelection } from "@/lib/file-validation";

const aspects = [
  "Cut pacing",
  "Framing and color",
  "Caption treatment",
  "Transitions and graphics",
  "Music mood and sound placement",
];
export function ReferenceStylePanel({
  onChange,
  disabled,
}: {
  onChange: (brief: string) => void;
  disabled: boolean;
}) {
  const { workspace, updateWorkspace, capabilities } = useWorkspace();
  const [assetId, setAssetId] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState(aspects);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const asset = workspace.assets.find(a => a.id === assetId);
  const cost = timedCreditCost(
    asset?.duration,
    AI_CREDIT_COSTS.videoAnalysisPerMinute
  );
  function invalidate() {
    setResult("");
    onChange("");
  }
  async function upload(file: File) {
    const checked = validateFileSelection([file], {
      purpose: "media",
      multiple: false,
      maxFiles: 1,
    });
    if (checked.error || !file.type.startsWith("video/")) {
      setError(checked.error || "Choose a video file.");
      return;
    }
    setBusy(true);
    setError("");
    invalidate();
    try {
      const uploaded = await platformApi.uploadAsset(file, "video");
      await updateWorkspace(w => ({
        ...w,
        assets: [...w.assets.filter(a => a.id !== uploaded.id), uploaded],
      }));
      const duration = await resolveMediaDuration(uploaded);
      await updateWorkspace(w => ({
        ...w,
        assets: w.assets.map(a =>
          a.id === uploaded.id ? { ...a, duration } : a
        ),
      }));
      setAssetId(uploaded.id);
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    setBusy(true);
    setError("");
    invalidate();
    try {
      const response = await platformApi.analyzeVideo({
        assetId: assetId || undefined,
        publicUrl: assetId ? undefined : url.trim(),
        platform: "instagram",
        sourceRightsConfirmed: rights,
        focus: `Create a reference-style brief for ONLY these aspects: ${selected.join(", ")}. Describe observed timing, visual treatment, and sound placement with timestamps. Distinguish observations from unknowns. Do not copy dialogue, melody, or copyrighted assets. If the video cannot be inspected, say so; do not invent a style.`,
      });
      const brief = `Selected reference aspects: ${selected.join(", ")}. Observed reference: ${response.summary}. Timestamped evidence: ${JSON.stringify(response.retention)}. Match these stylistic patterns using the user's own footage and licensed media, not literal copied assets. Unsupported effects must be reported, not claimed as applied.`;
      setResult(response.summary);
      onChange(brief);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Reference could not be inspected. Upload the video instead."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="my-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Match a reference style
      </summary>
      <fieldset
        disabled={busy || disabled}
        className="mt-3 space-y-3 disabled:opacity-50"
      >
        <p className="text-xs text-foreground/70">
          Choose a video or link, then select what to study. Social links must
          expose playable video; private or unsupported links need an upload.
          This matches observed style, not an exact copy of effects or audio.
        </p>
        <select
          aria-label="Reference video"
          value={assetId}
          onChange={e => {
            setAssetId(e.target.value);
            invalidate();
          }}
          className="w-full rounded-lg border border-border bg-background p-2 text-sm"
        >
          <option value="">Use a link or upload a reference</option>
          {workspace.assets
            .filter(a => a.kind === "video" && a.status === "ready")
            .map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
        <input
          type="url"
          aria-label="Reference video link"
          disabled={Boolean(assetId)}
          value={url}
          onChange={e => {
            setUrl(e.target.value);
            invalidate();
          }}
          placeholder="https://…"
          className="w-full rounded-lg border border-border bg-background p-2 text-sm"
        />
        <label className="block text-xs">
          Upload reference
          <input
            type="file"
            accept="video/*"
            className="mt-1 block w-full text-xs"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        <button
          type="button"
          className="text-xs text-primary"
          onClick={() => {
            setSelected(selected.length === aspects.length ? [] : aspects);
            invalidate();
          }}
        >
          {selected.length === aspects.length ? "Deselect all" : "Select all"}
        </button>
        <div className="grid gap-2 sm:grid-cols-2">
          {aspects.map(a => (
            <label key={a} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(a)}
                onChange={e => {
                  setSelected(s =>
                    e.target.checked ? [...s, a] : s.filter(x => x !== a)
                  );
                  invalidate();
                }}
              />
              {a}
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={rights}
            onChange={e => setRights(e.target.checked)}
          />
          I may submit this video to the AI analysis provider.
        </label>
        <button
          type="button"
          disabled={
            !rights ||
            !selected.length ||
            (!assetId && !url.trim()) ||
            !capabilities.analysis
          }
          onClick={() => void analyze()}
          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
        >
          Analyze reference · {cost} credits
        </button>
      </fieldset>
      {busy && (
        <p role="status" className="mt-2 text-xs">
          Inspecting reference…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {result && <p className="mt-3 whitespace-pre-wrap text-sm">{result}</p>}
    </details>
  );
}
