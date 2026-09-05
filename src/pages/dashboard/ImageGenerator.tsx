import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { Asset, WorkspaceEvent } from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";
import { AiProvenanceBadge } from "@/components/compliance/AiProvenanceBadge";
import { EditAssetLink } from "@/components/studio/EditAssetLink";
import posthog from "@/lib/posthog";
import { imageCreditCost } from "@contracts/billing";

const RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"] as const;

function createEvent(asset: Asset): WorkspaceEvent {
  return {
    id: crypto.randomUUID(),
    type: "generation",
    label: "Image generated",
    detail: asset.name,
    createdAt: new Date().toISOString(),
  };
}

function previewRatio(ratio: (typeof RATIOS)[number]) {
  if (ratio === "9:16") return "aspect-[9/16]";
  if (ratio === "16:9") return "aspect-video";
  if (ratio === "4:3") return "aspect-[4/3]";
  if (ratio === "3:4") return "aspect-[3/4]";
  return "aspect-square";
}

export default function ImageGenerator() {
  const { workspace, capabilities, loading, updateWorkspace } = useWorkspace();
  const [assetName, setAssetName] = useState("Untitled image");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] =
    useState<(typeof RATIOS)[number]>("1:1");
  const [resolution, setResolution] = useState<"1K" | "2K">("1K");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [containsRealPerson, setContainsRealPerson] = useState(false);
  const [realPersonConsentConfirmed, setRealPersonConsentConfirmed] =
    useState(false);
  const [generating, setGenerating] = useState(false);
  const [resultAsset, setResultAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recentImages = useMemo(
    () => workspace.assets.filter(asset => asset.kind === "image").slice(0, 6),
    [workspace.assets]
  );
  const ready = capabilities.imageGeneration;

  const invalidateAttestation = () => {
    setRightsConfirmed(false);
    setRealPersonConsentConfirmed(false);
  };

  const generate = async () => {
    if (
      !ready ||
      !assetName.trim() ||
      !prompt.trim() ||
      !rightsConfirmed ||
      (containsRealPerson && !realPersonConsentConfirmed) ||
      generating
    ) {
      return;
    }
    setGenerating(true);
    setResultAsset(null);
    setError(null);
    try {
      const asset = await platformApi.generateImage({
        prompt: prompt.trim(),
        assetName: assetName.trim(),
        aspectRatio,
        resolution,
        rightsConfirmed: true,
        referenceContainsRealPerson: containsRealPerson,
        realPersonConsentConfirmed,
      });
      setResultAsset(asset);
      await updateWorkspace(current => ({
        ...current,
        assets: [
          asset,
          ...current.assets.filter(candidate => candidate.id !== asset.id),
        ],
        activity: [createEvent(asset), ...current.activity].slice(0, 100),
      }));
      posthog?.capture("image_generation_completed", {
        aspect_ratio: aspectRatio,
        resolution,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The image could not be generated."
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">AI Image Studio</p>
        <h1 className="text-3xl font-semibold">Create a visual</h1>
        <p className="mt-2 max-w-3xl text-foreground/60">
          Generate campaign images, thumbnails, backgrounds, and supporting
          visuals. Every result is saved automatically to your connected media
          library under the name you choose.
        </p>
      </div>

      {!loading && !ready ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium">
              Image generation is temporarily unavailable
            </p>
            <p className="mt-1 text-xs text-foreground/70">
              Your saved images and uploads remain available in the Library and
              Edit.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <section className="rounded-xl border border-border bg-surface p-6">
          <label className="block text-xs font-medium" htmlFor="image-name">
            Image name
          </label>
          <input
            id="image-name"
            value={assetName}
            maxLength={110}
            onChange={event => setAssetName(event.target.value)}
            placeholder="Summer launch — hero image"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />

          <label
            className="mt-5 block text-xs font-medium"
            htmlFor="image-prompt"
          >
            Describe the image
          </label>
          <textarea
            id="image-prompt"
            value={prompt}
            maxLength={4000}
            rows={9}
            onChange={event => {
              setPrompt(event.target.value);
              invalidateAttestation();
            }}
            placeholder="A high-contrast editorial product shot with..."
            className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm leading-relaxed"
          />
          <p className="mt-1 text-right text-xs text-foreground/35">
            {prompt.length}/4000
          </p>

          <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-medium">Aspect ratio</legend>
            <div className="grid grid-cols-5 gap-2">
              {RATIOS.map(ratio => (
                <button
                  key={ratio}
                  type="button"
                  aria-pressed={aspectRatio === ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                    aspectRatio === ratio
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["1K", "2K"] as const).map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={resolution === value}
                onClick={() => setResolution(value)}
                className={`rounded-lg border py-2.5 text-xs font-medium ${
                  resolution === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-2 rounded-lg border border-border bg-background p-3 text-xs leading-relaxed">
            <label className="flex items-start gap-2 text-foreground/65">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={event => setRightsConfirmed(event.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>
                I may use this prompt, its brands, and its likenesses.
              </span>
            </label>
            <label className="flex items-start gap-2 text-foreground/65">
              <input
                type="checkbox"
                checked={containsRealPerson}
                onChange={event => {
                  setContainsRealPerson(event.target.checked);
                  invalidateAttestation();
                }}
                className="mt-0.5 accent-primary"
              />
              <span>The image will depict an identifiable real person.</span>
            </label>
            {containsRealPerson ? (
              <label className="flex items-start gap-2 text-foreground/65">
                <input
                  type="checkbox"
                  checked={realPersonConsentConfirmed}
                  onChange={event =>
                    setRealPersonConsentConfirmed(event.target.checked)
                  }
                  className="mt-0.5 accent-primary"
                />
                <span>
                  I hold documented consent or another verified legal basis.
                </span>
              </label>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={
              !ready ||
              !assetName.trim() ||
              !prompt.trim() ||
              !rightsConfirmed ||
              (containsRealPerson && !realPersonConsentConfirmed) ||
              generating
            }
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating image
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate image ·{" "}
                {imageCreditCost(resolution)} credits
              </>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-foreground/65">
            Credits are returned automatically if generation fails.
          </p>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-5">
            {resultAsset ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{resultAsset.name}</p>
                    <p className="mt-0.5 text-xs text-foreground/65">
                      Saved to your image library
                    </p>
                  </div>
                  <AiProvenanceBadge provenance={resultAsset.provenance} />
                </div>
                <div
                  className={`mx-auto max-h-[620px] overflow-hidden rounded-lg bg-black ${previewRatio(aspectRatio)}`}
                >
                  <img
                    src={resultAsset.url}
                    alt={resultAsset.name}
                    className="h-full w-full object-contain"
                  />
                </div>
                <EditAssetLink
                  assetId={resultAsset.id}
                  label="Add image to Edit"
                  className="mt-4"
                />
                <a
                  href={resultAsset.url}
                  download={resultAsset.name}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-medium hover:border-primary/45"
                >
                  <Download className="h-4 w-4" /> Download image
                </a>
              </motion.div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </span>
                <p className="mt-4 text-sm font-medium">
                  Your generated image will appear here
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-foreground/65">
                  Name it, describe it, choose its format, and generate. The
                  saved result is immediately available inside Edit.
                </p>
              </div>
            )}
          </section>

          {recentImages.length ? (
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Recent images</h2>
                <span className="text-xs uppercase tracking-wider text-foreground/35">
                  Connected library
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {recentImages.map(asset => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setResultAsset(asset)}
                    className="overflow-hidden rounded-lg border border-border bg-background text-left hover:border-primary/40"
                    title={asset.name}
                  >
                    <img
                      src={asset.url}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                    <span className="block truncate px-2 py-1.5 text-xs">
                      {asset.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
