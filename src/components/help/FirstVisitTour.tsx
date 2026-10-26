import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";
import {
  placeTourCard,
  visibleTourRect,
  type TourRect,
} from "@/lib/tour-placement";

type Step = { target: string; title: string; text: string };
const tours: Record<string, Step[]> = {
  edit: [
    {
      target: '#editor-media-panel [role="tablist"]',
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
      target: '[data-tour="library-upload"]',
      title: "One home for your media",
      text: "Upload footage once and reuse it in your edits. Drag files onto the page, or choose Upload media.",
    },
    {
      target: '[data-tour="library-find"]',
      title: "Find the right file",
      text: "Search by name, narrow by media type, then use folders and source filters to find uploads, generations or stock.",
    },
  ],
  script: [
    {
      target: "#script-topic",
      title: "Start with a clear idea",
      text: "Describe the topic and audience here. Choose the platform, tone and length below to shape your draft.",
    },
    {
      target: '[data-tour="script-result"] > :first-child',
      title: "Shape the draft",
      text: "Your script appears here. Edit its hook, body and ending, then save it or continue into media creation.",
    },
    {
      target: '[data-tour="script-modes"]',
      title: "Build it through a conversation",
      text: "Choose Interview me when you want help finding the story. Answer short follow-up questions to turn your experience into a script.",
    },
  ],
  analyze: [
    {
      target: '[data-tour="analysis-source"]',
      title: "Find what to improve",
      text: "Upload a video, choose one from Library, or import a direct video link. Add a goal below when you want a focused review.",
    },
    {
      target: '[data-tour="analysis-run"]',
      title: "Review, then improve",
      text: "Start the review at the displayed credit cost. The result links feedback to moments in your video; Optimize carries it into an editable project.",
    },
  ],
  styles: [
    {
      target: '[data-tour="styles-create"]',
      title: "Create a reusable style",
      text: "Choose New style to define an editing language, caption treatment, graphic or color look. You can edit every setting.",
    },
    {
      target: '[data-tour="styles-library"]',
      title: "Keep your visual language",
      text: "Your saved styles live here. Open one to adjust it, then use it in an edit. Saving a style does not start an AI request.",
    },
  ],
  publish: [
    {
      target: "#publisher-platform",
      title: "Choose where it goes",
      text: "Choose a platform and connected account, then select the finished video you want to publish.",
    },
    {
      target: '[data-tour="publish-compose"]',
      title: "Prepare your release",
      text: "Write the post and choose its timing. Save a draft or review the finished publication before sending it.",
    },
  ],
};
function wasSeen(key: string) {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return false;
  }
}
function measurableTarget(selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target || !target.getClientRects().length) return null;
  const rect = target.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? target : null;
}
export function FirstVisitTour() {
  const { pathname } = useLocation();
  const { workspace } = useWorkspace();
  const route = pathname.split("/")[2] ?? "home";
  const scope = `reelassati:tour:v3:${workspace.profile.email}:${route}`;
  return tours[route] ? (
    <TourSession key={scope} scope={scope} route={route} />
  ) : null;
}
function TourSession({ scope, route }: { scope: string; route: string }) {
  const ui = useUiText();
  const [step, setStep] = useState(0),
    [active, setActive] = useState(false);
  const [layout, setLayout] = useState<{
    target: TourRect;
    left: number;
    top: number;
  }>();
  const card = useRef<HTMLElement>(null);
  const steps = tours[route];
  useEffect(() => {
    if (wasSeen(scope)) return;
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const first = steps.findIndex(item => measurableTarget(item.target));
        if (!wasSeen(scope) && first >= 0) {
          setStep(first);
          setActive(true);
          observer.disconnect();
        }
      });
    };
    const observer = new MutationObserver(reveal);
    observer.observe(document.body, { childList: true, subtree: true });
    reveal();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [scope, steps]);
  useLayoutEffect(() => {
    if (!active) return;
    const target = measurableTarget(steps[step].target);
    if (!target) {
      const frame = requestAnimationFrame(() => setLayout(undefined));
      return () => cancelAnimationFrame(frame);
    }
    target.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    let frame = 0;
    const measure = () => {
      const r = target.isConnected
        ? visibleTourRect(
            target.getBoundingClientRect(),
            window.innerWidth,
            window.innerHeight,
            56
          )
        : null;
      if (!r) {
        setLayout(undefined);
        return;
      }
      const size = card.current?.getBoundingClientRect();
      setLayout({
        target: r,
        ...placeTourCard(
          r,
          { width: size?.width ?? 320, height: size?.height ?? 246 },
          { width: window.innerWidth, height: window.innerHeight }
        ),
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(target);
    if (card.current) resize.observe(card.current);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    measure();
    return () => {
      resize.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [active, step, steps]);
  function close() {
    try {
      localStorage.setItem(scope, "seen");
    } catch {
      /* closes for this session */
    }
    setActive(false);
  }
  function advance(delta: number) {
    let next = step + delta;
    while (
      next >= 0 &&
      next < steps.length &&
      !measurableTarget(steps[next].target)
    )
      next += delta;
    if (next >= steps.length) close();
    else if (next >= 0) setStep(next);
  }
  if (!active) return null;
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
        onPointerDownOutside={event => event.preventDefault()}
      >
        {layout && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed rounded-lg border border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]"
            style={layout.target}
          />
        )}
        <section
          ref={card}
          className="tour-card"
          style={{ left: layout?.left ?? 16, top: layout?.top ?? 16 }}
        >
          <button
            type="button"
            onClick={close}
            aria-label={ui("Close guide")}
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={15} />
          </button>
          <p className="mb-3 text-[11px] tabular-nums text-muted-foreground">
            {step + 1} / {steps.length}
          </p>
          <Dialog.Title className="text-sm font-semibold">
            {ui(steps[step].title)}
          </Dialog.Title>
          <Dialog.Description
            id="tour-description"
            className="mt-2 text-[13px] leading-relaxed text-muted-foreground"
          >
            {ui(steps[step].text)}
          </Dialog.Description>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="mr-auto text-xs text-muted-foreground"
            >
              {ui("Skip")}
            </button>
            {step > 0 && (
              <button
                type="button"
                onClick={() => advance(-1)}
                aria-label={ui("Back")}
                className="rounded-md border border-border p-2"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => advance(1)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
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
