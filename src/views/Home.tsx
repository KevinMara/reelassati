import { MarketingLayout } from "@/components/brand/MarketingLayout";

export default function Home() {
  return (
    <MarketingLayout>
      <div className="container mx-auto py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">Reelassati</h1>
        <p className="text-xl text-muted-foreground italic mb-12">Fai reel, reelassati.</p>
        <div className="bg-primary/5 rounded-2xl p-20 border border-primary/10">
          <p className="text-muted-foreground">The homepage is being optimized for Next.js. Please check back soon.</p>
        </div>
      </div>
    </MarketingLayout>
  );
}
