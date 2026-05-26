import { MarketingLayout } from "@/components/brand/MarketingLayout";

export default function NotFound() {
  return (
    <MarketingLayout>
      <div className="container mx-auto py-20 text-center">
        <h1 className="text-4xl font-bold mb-6">404 - Not Found</h1>
        <p>The page you are looking for does not exist.</p>
      </div>
    </MarketingLayout>
  );
}
