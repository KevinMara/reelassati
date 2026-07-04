import { useState, useCallback, useEffect } from "react";
import EntryAnimation from "@/components/entry/EntryAnimation";

export default function EntryDemo() {
  const [key, setKey] = useState(0);
  const [done, setDone] = useState(false);

  // Clear sessionStorage so animation always plays on this demo page
  useEffect(() => {
    sessionStorage.removeItem("entryAnimPlayed");
  }, [key]);

  const handleReplay = useCallback(() => {
    setDone(false);
    setKey((k) => k + 1);
  }, []);

  return (
    <div className="relative w-screen h-screen">
      <EntryAnimation
        key={key}
        force
        onComplete={() => setDone(true)}
      />
      {done && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-50">
          <p className="text-lg font-medium text-foreground/70">Animation complete</p>
          <button
            onClick={handleReplay}
            className="px-6 py-3 rounded-full bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
          >
            Replay animation
          </button>
        </div>
      )}
    </div>
  );
}
