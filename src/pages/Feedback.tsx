import { Footer } from "@/components/Footer";
import { FeedbackCenter } from "@/components/feedback/FeedbackCenter";
import { Navbar } from "@/components/Navbar";

export default function Feedback() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pb-24 pt-28">
        <div className="container-page">
          <header className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mono-eyebrow text-primary">Product feedback</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
              Help shape REELassati
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty leading-relaxed text-foreground/60">
              Found a problem or have an idea? Send it directly to the product
              queue with the context needed to act on it.
            </p>
          </header>
          <FeedbackCenter />
        </div>
      </main>
      <Footer />
    </div>
  );
}
