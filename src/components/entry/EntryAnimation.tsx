import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SESSION_KEY } from "./entry-constants";
import "./entry-animation.css";

export interface EntryAnimationProps {
  force?: boolean;
  onComplete?: () => void;
}

const WORDMARK = "REELassati";
const BACKDROP_FADE_START_MS = 620;
const BACKDROP_FADE_DURATION_MS = 620;
const LOCKUP_FADE_START_MS = 940;
const LOCKUP_FADE_DURATION_MS = 360;

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
  const [isBackdropFading, setIsBackdropFading] = useState(false);
  const [isLockupFading, setIsLockupFading] = useState(false);
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

  useLayoutEffect(() => {
    document.documentElement.classList.remove("entry-route-pending");
    document.getElementById("entry-boot-screen")?.remove();
  }, []);

  const finish = useCallback(() => {
    document.documentElement.style.overflow = "";
    markEntryPlayed();
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
    const backdropTimer = window.setTimeout(
      () => setIsBackdropFading(true),
      BACKDROP_FADE_START_MS,
    );
    const lockupTimer = window.setTimeout(
      () => setIsLockupFading(true),
      LOCKUP_FADE_START_MS,
    );
    return () => {
      window.clearTimeout(backdropTimer);
      window.clearTimeout(lockupTimer);
    };
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
        <div className="entry-anim-backdrop" />
        <span className="sr-only">Opening REELassati Studio</span>
        <div className="entry-lockup-layer">
          <StaticLockup />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="entry-anim-overlay"
    >
      <motion.div
        className="entry-anim-backdrop"
        initial={{ opacity: 1 }}
        animate={{ opacity: isBackdropFading ? 0 : 1 }}
        transition={{
          duration: isBackdropFading ? BACKDROP_FADE_DURATION_MS / 1_000 : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
      />
      <span className="sr-only">Opening REELassati Studio</span>
      <motion.div
        className="entry-lockup-layer"
        initial={{ opacity: 1 }}
        animate={{ opacity: isLockupFading ? 0 : 1 }}
        transition={{
          duration: isLockupFading ? LOCKUP_FADE_DURATION_MS / 1_000 : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={() => {
          if (isLockupFading) finish();
        }}
      >
        <div className="entry-lockup-stage">
          <AnimatedMark />
          <AnimatedWordmark />
        </div>
      </motion.div>
    </motion.div>
  );
}
