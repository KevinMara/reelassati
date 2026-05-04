import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Link as LinkIcon, FileVideo, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const GOALS = ["virality", "conversion", "brand_awareness", "education", "entertainment"];
const PLATFORMS = [
  { key: "tiktok", label: "TikTok", icon: "🎵" },
  { key: "instagram", label: "Instagram", icon: "📸" },
  { key: "youtube", label: "YouTube", icon: "▶️" },
  { key: "linkedin", label: "LinkedIn", icon: "💼" },
];

export type AnalyzePayload = {
  goal: string;
  audience: string;
  platform: string;
  notes: string;
  language: string;
};

export function UploadStage({ onAnalyze }: { onAnalyze: (p: AnalyzePayload) => void }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("virality");
  const [client, setClient] = useState("none");
  const [audience, setAudience] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok"]);
  const [drag, setDrag] = useState(false);

  const ready = !!file || url.length > 5;

  const togglePlatform = (k: string) =>
    setPlatforms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  return (
    <div className="space-y-8">
      {/* Top: client + goal + audience + platforms */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-foreground/55 mb-1.5 font-medium">
              {t("app.analyze.upload.client")}
            </label>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— {t("app.analyze.upload.no_client")} —</SelectItem>
                <SelectItem value="mock1">Pizzeria Da Mario</SelectItem>
                <SelectItem value="mock2">Studio Legale Bianchi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-foreground/55 mb-1.5 font-medium">
              {t("app.analyze.upload.goal")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={cn(
                    "px-3 py-1.5 rounded-pill text-xs border transition-colors",
                    goal === g
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-foreground/70 hover:border-foreground/30",
                  )}
                >
                  {t(`app.analyze.upload.goals.${g}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-foreground/55 mb-1.5 font-medium">
              {t("app.analyze.upload.audience")}
            </label>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder={t("app.analyze.upload.audience_placeholder")}
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-foreground/55 mb-1.5 font-medium">
              {t("app.analyze.upload.platforms")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => togglePlatform(p.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-pill text-xs border transition-colors inline-flex items-center gap-1.5",
                    platforms.includes(p.key)
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border text-foreground/70 hover:border-foreground/30",
                  )}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all duration-300 ease-out-expo",
          "min-h-[280px] flex flex-col items-center justify-center text-center px-6 py-10",
          drag ? "border-primary bg-primary/[0.04] scale-[1.005]" : "border-border bg-surface/50",
          file && "border-primary/60 bg-primary/[0.03]",
        )}
      >
        <input
          type="file"
          id="video-upload"
          accept="video/*"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <FileVideo className="h-10 w-10 text-primary mb-3" />
            <div className="text-base font-medium text-foreground">{file.name}</div>
            <div className="text-xs text-foreground/50 mt-1 tabular">
              {(file.size / (1024 * 1024)).toFixed(1)} MB
            </div>
            <button
              onClick={(e) => { e.preventDefault(); setFile(null); }}
              className="mt-3 text-xs text-foreground/50 underline"
            >
              {t("app.analyze.upload.replace")}
            </button>
          </>
        ) : (
          <>
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Upload className="h-6 w-6" />
            </div>
            <div className="text-base font-medium text-foreground">{t("app.analyze.upload.drop")}</div>
            <div className="text-xs text-foreground/50 mt-1">{t("app.analyze.upload.formats")}</div>
          </>
        )}
      </div>

      {/* URL + library */}
      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center">
        <div className="relative">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("app.analyze.upload.paste_url")}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="default" type="button">
          <BookOpen className="h-4 w-4" />
          {t("app.analyze.upload.from_library")}
        </Button>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          size="lg"
          disabled={!ready}
          onClick={() =>
            onAnalyze({
              goal,
              audience,
              platform: platforms[0] ?? "tiktok",
              notes: file ? `Local file: ${file.name}` : `Source URL: ${url}`,
              language: "it",
            })
          }
        >
          {t("app.analyze.upload.analyze")}
        </Button>
      </div>
    </div>
  );
}
