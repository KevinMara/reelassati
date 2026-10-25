import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocation } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";

type Step = { target: string; title: string; text: string };
const tours: Record<string, Step[]> = {
  edit: [
    {
      target: "#editor-media-panel",
      title: "Your media and tools",
      text: "Add footage, captions, graphics and color here. Select a timeline item to adjust it.",
    },
    {
      target: "#editor-chat-panel",
      title: "Meet Reel",
      text: "Describe a change or start Auto-edit. Use + for references and time ranges, @ for tasks, and the brain for effort and extras.",
    },
    {
      target: "#editor-timeline-panel",
      title: "Keep every decision editable",
      text: "Drag and trim clips here. Resize the panels to fit your workflow. Changes can be undone.",
    },
  ],
  library: [
    {
      target: "main h1",
      title: "One home for your media",
      text: "Organize files in folders and filter by source, type or date. Your uploads stay separate from stock.",
    },
  ],
  analyze: [
    {
      target: "main h1",
      title: "Find what to improve",
      text: "Review timestamped evidence, strengths and improvements. Optimize opens an editable brief in the editor.",
    },
  ],
  script: [
    {
      target: "main h1",
      title: "Start with a clear idea",
      text: "Describe your goal and audience, then shape the script before producing media or opening an edit.",
    },
  ],
  styles: [
    {
      target: "main h1",
      title: "Build your editing language",
      text: "Choose an editing direction or save reusable captions, graphics and looks. A style adapts to each video's content.",
    },
  ],
  publish: [
    {
      target: "main h1",
      title: "Prepare your release",
      text: "Choose a finished video and connected account, then review the post before publishing.",
    },
  ],
};

/** A short, local-only introduction. Never starts an AI request or upload. */
export function FirstVisitTour() {
  const { pathname } = useLocation();
  const { workspace } = useWorkspace();
  const route = pathname.split("/")[2] ?? "home";
  const scope=`reelassati:tour:v2:${workspace.profile.email}:${route}`;
  return tours[route]?<TourSession key={scope} scope={scope} route={route}/>:null;
}
function TourSession({scope,route}:{scope:string;route:string}) {
  const ui=useUiText();
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect>();
  const key=scope;
  const steps = tours[route];
  useEffect(() => {
    if (!tours[route] || localStorage.getItem(key)) return;
    const reveal = () => {
      if (
        !localStorage.getItem(key) &&
        document.querySelector(tours[route][0].target)
      )
        setActive(true);
    };
    const observer = new MutationObserver(reveal);
    observer.observe(document.body, { childList: true, subtree: true });
    const frame=requestAnimationFrame(reveal);
    return () => {observer.disconnect();cancelAnimationFrame(frame);};
  }, [key, route]);
  useEffect(() => {
    if (!active) return;
    const target = document.querySelector(steps[step]?.target);
    target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    const measure = () => setRect(target?.getBoundingClientRect());
    const frame=requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step, steps]);
  function close() {
    localStorage.setItem(key, "seen");
    setActive(false);
  }
  if (!active || !steps[step] || !rect) return null;
  const cardLeft = Math.max(
    16,
    Math.min(window.innerWidth - 350, rect.right + 18)
  );
  const cardTop = Math.max(
    80,
    Math.min(window.innerHeight - 230, rect.top + 20)
  );
  return createPortal(
    <Dialog.Root
      open
      onOpenChange={value => {
        if (!value) close();
      }}
    >
      <Dialog.Content
        className="fixed inset-0 z-[90] outline-none"
        aria-describedby="tour-description"
      >
        <div
          className="absolute rounded-2xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-all motion-reduce:transition-none"
          style={{
            top: rect.top - 5,
            left: rect.left - 5,
            width: rect.width + 10,
            height: rect.height + 10,
          }}
        />
        <section
          className="absolute w-[min(330px,calc(100vw-32px))] rounded-2xl border border-primary/30 bg-surface p-5 shadow-2xl"
          style={{ left: cardLeft, top: cardTop }}
        >
          <button
            type="button"
            onClick={close}
            aria-label={ui("Close guide")}
            className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
          <p className="mb-3 font-mono text-[11px] text-primary">
            {step + 1} / {steps.length}
          </p>
          <Dialog.Title className="text-base font-semibold">
            {ui(steps[step].title)}
          </Dialog.Title>
          <Dialog.Description
            id="tour-description"
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
          >
            {ui(steps[step].text)}
          </Dialog.Description>
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={close}
              className="text-xs text-muted-foreground"
            >
              {ui("Skip")}
            </button>
            <button
              type="button"
              onClick={() =>
                step + 1 === steps.length ? close() : setStep(step + 1)
              }
              className="ai-magic inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {ui(step + 1 === steps.length ? "Got it" : "Next")}
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </Dialog.Content>
    </Dialog.Root>,
    document.body
  );
}
