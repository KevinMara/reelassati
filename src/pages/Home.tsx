import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/sections/Hero";
import AISandbox from "@/sections/AISandbox";
import { Features } from "@/sections/Features";
import { HowItWorks } from "@/sections/HowItWorks";
import { Platforms } from "@/sections/Platforms";
import { PricingTeaser } from "@/sections/PricingTeaser";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-16">
        <Hero />
        <AISandbox />
        <Features />
        <HowItWorks />
        <Platforms />
        <PricingTeaser />
      </main>
      <Footer />
    </div>
  );
}
