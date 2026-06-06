import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app/AppShell";
import { PlatformPicker } from "@/components/publisher/PlatformPicker";
import { CaptionEditor } from "@/components/publisher/CaptionEditor";
import { ScheduleHeatmap } from "@/components/publisher/ScheduleHeatmap";
import { ThumbnailSection } from "@/components/publisher/ThumbnailSection";
import { PLATFORMS, CAPTIONS, MOCK_REEL, buildHeatmap, type Platform, type CaptionVariant } from "@/components/publisher/mockData";
import { Button } from "@/components/ui/button";
import { Send, Clock, Layout, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Publish() {
  const { t } = useTranslation();
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["instagram", "tiktok", "youtube"]);
  const [captions, setCaptions] = useState<CaptionVariant[]>(CAPTIONS);
  const [activeTab, setActiveTab] = useState<Platform>(selectedPlatforms[0]);

  const togglePlatform = (id: Platform) => {
    setSelectedPlatforms((prev) => 
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const updateCaption = (updated: CaptionVariant) => {
    setCaptions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handlePublish = () => {
    toast({
      title: "Publishing sequence started",
      description: `Sending to ${selectedPlatforms.length} platforms...`,
    });
  };

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="mono-eyebrow text-primary mb-2">{t("app.nav.publish")}</p>
            <h1 className="text-3xl font-semibold tracking-tight">Smart Publisher</h1>
            <p className="text-foreground/60 mt-2">Verified native APIs. Zero credentials stored.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2">
              <Clock className="h-4 w-4" />
              Schedule all
            </Button>
            <Button variant="primary" size="lg" className="gap-2 px-8" onClick={handlePublish}>
              <Send className="h-4 w-4" />
              Publish now
            </Button>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-8">
            {/* Platform Selection */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-4 flex items-center gap-2">
                <Layout className="h-4 w-4" /> Target Platforms
              </h3>
              <PlatformPicker 
                selected={selectedPlatforms} 
                onToggle={togglePlatform} 
              />
            </section>

            {/* Captions Editor */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Platform Captions
              </h3>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {selectedPlatforms.map(pId => {
                  const p = PLATFORMS.find(x => x.id === pId);
                  if (!p) return null;
                  return (
                    <Button 
                      key={pId}
                      variant={activeTab === pId ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveTab(pId)}
                      className="gap-2 whitespace-nowrap"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${p.color})` }} />
                      {p.name}
                    </Button>
                  )
                })}
              </div>

              {selectedPlatforms.map(pId => {
                const caption = captions.find(c => c.platform === pId);
                const platform = PLATFORMS.find(p => p.id === pId);
                if (!caption || !platform || activeTab !== pId) return null;

                return (
                  <CaptionEditor
                    key={pId}
                    platform={pId}
                    caption={caption}
                    onChange={updateCaption}
                    onRegenerate={() => toast({ title: "Caption regenerated for " + platform.name })}
                  />
                )
              })}
            </section>
          </div>

          <aside className="space-y-8">
            {/* Thumbnail Preview */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-4">
                Media Preview
              </h3>
              <ThumbnailSection reel={MOCK_REEL} />
            </section>

            {/* Schedule Heatmap */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-4">
                Best time to post
              </h3>
              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-xs text-foreground/50 mb-4">Based on historical client performance.</p>
                <ScheduleHeatmap slots={buildHeatmap(activeTab)} />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
