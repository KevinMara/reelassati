import { useEffect, useId, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { useUiText } from "@/lib/i18n/ui";
import { colorGradeMatrix, colorToneTable } from "@/lib/color-grade";
import {
  normalizeVisual,
  visualFrame,
  type VisualTransition,
} from "@contracts/clip-visual";
import type { ClipLookPreset } from "@contracts/editor-presets";
import type { TimelineClip } from "@contracts/workspace";

/** Uses the same color/transition math as the timeline; inspecting never applies an edit. */
export function PresetPreview({
  name,
  look,
  transition,
  seconds = 0.4,
  fade,
}: {
  name: string;
  look?: ClipLookPreset["settings"];
  transition?: VisualTransition;
  seconds?: number;
  fade?: { fadeIn: number; fadeOut: number };
}) {
  const ui = useUiText();
  const filterId = `look-${useId().replace(/:/g, "")}`;
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0.2);
  const duration = fade ? 1.2 + fade.fadeIn + fade.fadeOut : seconds;
  useEffect(() => {
    if (
      !playing ||
      look ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      if (elapsed > (duration + 1) * 2) {
        setPlaying(false);
        return;
      }
      setTime(
        Math.max(0, Math.min(duration, (elapsed % (duration + 1)) - 0.5))
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, look]);
  const clip = {
    start: 0,
    inPoint: 0,
    outPoint: duration * 2 + 1,
    duration: duration * 2 + 1,
    visual: normalizeVisual({
      entrance: { kind: transition ?? "none", duration: seconds },
    }),
  } as TimelineClip;
  const frame = visualFrame(clip, Math.min(time, duration));
  const opacity = fade
    ? Math.max(
        0,
        Math.min(
          1,
          fade.fadeIn ? time / fade.fadeIn : 1,
          fade.fadeOut ? (duration - time) / fade.fadeOut : 1
        )
      )
    : frame.opacity;
  const picture = (extra?: string) => (
    <img
      src="/demo/coffee.jpg"
      alt=""
      loading="lazy"
      className={`absolute inset-0 h-full w-full object-cover ${extra ?? ""}`}
      style={{ objectPosition: "50% 66%" }}
    />
  );
  return (
    <button
      type="button"
      aria-label={ui("Preview {{name}}", { name: ui(name) })}
      title={ui("Preview")}
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => setPlaying(false)}
      onFocus={() => setPlaying(true)}
      onBlur={() => setPlaying(false)}
      onClick={() => {
        setPlaying(true);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          setTime(t => (t < duration / 2 ? duration : 0));
      }}
      className="relative block aspect-[1.7] w-full overflow-hidden rounded-md bg-[#101217] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {look ? (
        <>
          <svg className="absolute size-0" aria-hidden="true">
            <defs>
              <filter id={filterId} colorInterpolationFilters="sRGB">
                <feColorMatrix
                  type="matrix"
                  values={colorGradeMatrix(look).join(" ")}
                />
                <feComponentTransfer>
                  {["R", "G", "B"].map(c =>
                    c === "R" ? (
                      <feFuncR
                        key={c}
                        type="table"
                        tableValues={colorToneTable(look).join(" ")}
                      />
                    ) : c === "G" ? (
                      <feFuncG
                        key={c}
                        type="table"
                        tableValues={colorToneTable(look).join(" ")}
                      />
                    ) : (
                      <feFuncB
                        key={c}
                        type="table"
                        tableValues={colorToneTable(look).join(" ")}
                      />
                    )
                  )}
                </feComponentTransfer>
              </filter>
            </defs>
          </svg>
          <div
            className="absolute inset-0"
            style={{ filter: `url(#${filterId})` }}
          >
            {picture()}
          </div>
          {playing && (
            <div
              className="absolute inset-0"
              style={{ clipPath: "inset(0 50% 0 0)" }}
            >
              {picture()}
            </div>
          )}
          {playing && (
            <>
              <span className="absolute inset-y-0 left-1/2 w-px bg-white/80" />
              <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[9px] text-white">
                {ui("Original")}
              </span>
            </>
          )}
        </>
      ) : (
        <>
          {!fade && (
            <div className="absolute inset-0 bg-[#1c3440]" aria-hidden="true">
              <div className="absolute right-[18%] top-[16%] size-8 rounded-full bg-[#efca86]" />
              <div className="absolute -bottom-8 left-0 h-24 w-[80%] rotate-[-18deg] rounded-[40%] bg-[#467c79]" />
              <span className="absolute left-2 top-1.5 text-xs font-semibold text-white/80">
                A
              </span>
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{
              clipPath: `inset(${frame.reveal.top}% ${frame.reveal.right}% ${frame.reveal.bottom}% ${frame.reveal.left}%)`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                opacity,
                transform: `translate(${frame.x}%, ${frame.y}%) scale(${frame.scale})`,
              }}
            >
              {picture()}
              {!fade && (
                <span className="absolute left-2 top-1.5 text-xs font-semibold text-white/90">
                  B
                </span>
              )}
            </div>
          </div>
        </>
      )}
      <span
        className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white"
        aria-hidden="true"
      >
        {look ? <RotateCcw size={11} /> : <Play size={11} />}
      </span>
    </button>
  );
}
