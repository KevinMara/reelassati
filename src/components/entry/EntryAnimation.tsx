import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { ENTRY_ORIGIN_SCROLL_KEY, SESSION_KEY } from "./entry-constants";
import Home from "@/pages/Home";
import "./entry-animation.css";

export interface EntryAnimationProps {
  force?: boolean;
  onComplete?: () => void;
}

const WORDMARK = "REELassati";
const FADE_START_MS = 980;
const FADE_DURATION_MS = 280;

function PageMeltBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const [originScroll] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = Number(sessionStorage.getItem(ENTRY_ORIGIN_SCROLL_KEY));
    return Number.isFinite(stored) ? Math.max(0, stored) : 0;
  });
  const originStyle = {
    "--entry-origin-scroll": `${originScroll}px`,
  } as CSSProperties;

  if (reducedMotion) {
    return (
      <div className="entry-page-melt" aria-hidden="true" inert>
        <div className="entry-page-origin" style={originStyle}>
          <Home />
        </div>
        <div className="entry-page-wash entry-page-wash-reduced" />
      </div>
    );
  }

  return (
    <div className="entry-page-melt" aria-hidden="true" inert>
      <motion.div
        className="entry-page-origin"
        style={originStyle}
        initial={{ opacity: 1, filter: "grayscale(0%) contrast(100%) blur(0px)" }}
        animate={{
          opacity: [1, 0.96, 0.58, 0],
          filter: [
            "grayscale(0%) contrast(100%) blur(0px)",
            "grayscale(72%) contrast(94%) blur(0.5px)",
            "grayscale(100%) contrast(88%) blur(1.5px)",
            "grayscale(100%) contrast(92%) blur(2px)",
          ],
        }}
        transition={{
          duration: 1.24,
          times: [0, 0.3, 0.68, 1],
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <Home />
      </motion.div>

      <motion.div
        className="entry-page-wash"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0.94, 0] }}
        transition={{
          duration: 1.24,
          times: [0, 0.38, 0.6, 1],
          ease: [0.22, 1, 0.36, 1],
        }}
      />
    </div>
  );
}

export function hasEntryPlayed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function markEntryPlayed(): void {
  if (typeof window !== "undefined") sessionStorage.setItem(SESSION_KEY, "1");
}

function ThemeMarkImage({ className = "" }: { className?: string }) {
  return (
    <>
      <img
        src="/brand/reelassati-mark-light.png"
        alt=""
        className={`entry-mark-image entry-mark-image-light ${className}`}
        draggable={false}
      />
      <img
        src="/brand/reelassati-mark-transparent.png"
        alt=""
        className={`entry-mark-image entry-mark-image-dark ${className}`}
        draggable={false}
      />
    </>
  );
}

function AnimatedMark() {
  const slices = [
    { name: "bottom", delay: 0.08 },
    { name: "middle", delay: 0.16 },
    { name: "top", delay: 0.24 },
  ] as const;

  return (
    <motion.div
      className="entry-mark"
      initial={{ x: "var(--entry-mark-start-x)" }}
      animate={{ x: "0px" }}
      transition={{
        delay: 0.34,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {slices.map((slice) => (
        <motion.div
          key={slice.name}
          className={`entry-mark-slice entry-mark-slice-${slice.name}`}
          initial={{
            x: "-108%",
            opacity: 0,
          }}
          animate={{
            x: 0,
            opacity: [0, 1, 1],
          }}
          transition={{
            delay: slice.delay,
            duration: 0.16,
            times: [0, 0.06, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <ThemeMarkImage />
        </motion.div>
      ))}
    </motion.div>
  );
}

function AnimatedWordmark() {
  return (
    <motion.div
      className="entry-wordmark"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.38, duration: 0.12 }}
    >
      {WORDMARK.split("").map((letter, index) => {
        const isReel = index < 4;
        const isFirstAssatiLetter = index === 4;

        return (
          <motion.span
            // Index is safe here because this word is immutable.
            key={`${letter}-${index}`}
            className={
              isReel
                ? "entry-wordmark-reel"
                : `entry-wordmark-assati${isFirstAssatiLetter ? " entry-wordmark-assati-first" : ""}`
            }
            initial={{ opacity: 0, x: -10, filter: "blur(7px)" }}
            animate={{
              opacity: [0, 0.5, 1],
              x: 0,
              filter: ["blur(7px)", "blur(3px)", "blur(0px)"],
            }}
            transition={{
              delay: 0.4 + index * 0.048,
              duration: 0.3,
              times: [0, 0.42, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {letter}
          </motion.span>
        );
      })}
    </motion.div>
  );
}

function StaticLockup() {
  return (
    <div className="entry-static-lockup">
      <span className="entry-static-mark">
        <ThemeMarkImage />
      </span>
      <span className="entry-static-wordmark" aria-hidden="true">
        <strong>REEL</strong>
        <em>assati</em>
      </span>
    </div>
  );
}

export default function EntryAnimation({
  force = false,
  onComplete,
}: EntryAnimationProps) {
  const [phase, setPhase] = useState<"ready" | "playing" | "done">(() =>
    force || !hasEntryPlayed() ? "ready" : "done",
  );
  const [isFading, setIsFading] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const onCompleteRef = useRef(onComplete);
  const initiallyCompleteRef = useRef(phase === "done");

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = useCallback(() => {
    document.documentElement.style.overflow = "";
    markEntryPlayed();
    sessionStorage.removeItem(ENTRY_ORIGIN_SCROLL_KEY);
    setPhase("done");
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    if (initiallyCompleteRef.current) {
      onCompleteRef.current?.();
      return;
    }

    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;
    const frame = requestAnimationFrame(() => {
      setPhase("playing");
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const failSafe = window.setTimeout(finish, reducedMotion ? 700 : 7_000);
    return () => window.clearTimeout(failSafe);
  }, [finish, phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "playing" || reducedMotion) return;
    const timer = window.setTimeout(() => setIsFading(true), FADE_START_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  if (phase === "done") return null;

  if (reducedMotion) {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        className="entry-anim-overlay"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 0.1, duration: 0.2 }}
      >
        <span className="sr-only">Opening REELassati Studio</span>
        <PageMeltBackdrop reducedMotion />
        <StaticLockup />
      </motion.div>
    );
  }

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="entry-anim-overlay"
      initial={{ opacity: 1 }}
      animate={{ opacity: isFading ? 0 : 1 }}
      transition={{
        duration: isFading ? FADE_DURATION_MS / 1_000 : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      onAnimationComplete={() => {
        if (isFading) finish();
      }}
    >
      <span className="sr-only">Opening REELassati Studio</span>
      <PageMeltBackdrop reducedMotion={false} />
      <div className="entry-lockup-stage">
        <AnimatedMark />
        <AnimatedWordmark />
      </div>
    </motion.div>
  );
}
