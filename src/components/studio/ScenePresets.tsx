import { useState } from "react";
import { useWorkspace } from "@/providers/workspace";

export function ScenePresets({
  direction,
  onSelect,
}: {
  direction: Record<string, string>;
  onSelect: (value: Record<string, string>) => void;
}) {
  const { workspace, updateWorkspace, saving } = useWorkspace();
  const [name, setName] = useState(""),
    [notice, setNotice] = useState("");
  const presets = Array.isArray(workspace.brandKit.scenePresets)
    ? workspace.brandKit.scenePresets
    : [];
  async function save() {
    try {
      const label = name.trim();
      if (!label || !Object.values(direction).some(Boolean)) return;
      await updateWorkspace(w => ({
        ...w,
        brandKit: {
          ...w.brandKit,
          scenePresets: [
            {
              id: crypto.randomUUID(),
              name: label,
              direction: { ...direction },
            },
            ...(w.brandKit.scenePresets || []),
          ].slice(0, 20),
        },
      }));
      setName("");
      setNotice("Scene saved for this brand.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Scene could not be saved.");
    }
  }
  return (
    <div className="mb-5 rounded-xl border border-border bg-background/60 p-4">
      <label className="text-sm font-medium">
        Saved scenes
        <select
          aria-label="Reuse a saved scene"
          defaultValue=""
          onChange={e => {
            const preset = presets.find(p => p.id === e.target.value);
            if (preset) onSelect(preset.direction);
          }}
          className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-sm"
        >
          <option value="" disabled>
            Reuse a subject, setting, and style
          </option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex gap-2">
        <input
          aria-label="Scene name"
          placeholder="Name this scene"
          value={name}
          maxLength={80}
          onChange={e => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm"
        />
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => void save()}
          className="rounded-lg border border-primary/30 px-3 text-sm font-medium text-primary disabled:opacity-60"
        >
          Save scene
        </button>
      </div>
      {notice && (
        <p role="status" className="mt-2 text-xs text-foreground/70">
          {notice}
        </p>
      )}
    </div>
  );
}
