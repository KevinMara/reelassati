import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SESSION_KEY } from "./entry-constants";
import "./entry-animation.css";

export interface EntryAnimationProps {
  force?: boolean;
  onComplete?: () => void;
}

const WORDMARK = "REELassati";
const TOTAL_DURATION_MS = 4_000;

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
    { name: "bottom", delay: 0.28 },
    { name: "middle", delay: 0.86 },
    { name: "top", delay: 1.44 },
  ] as const;

  return (
    <motion.div
      className="entry-mark"
      initial={{ x: "var(--entry-mark-start-x)" }}
      animate={{ x: "0px" }}
      transition={{
        delay: 2.12,
        duration: 0.92,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {slices.map((slice) => (
        <motion.div
          key={slice.name}
          className={`entry-mark-slice entry-mark-slice-${slice.name}`}
          initial={{
            x: "-72%",
            opacity: 0,
            filter: "blur(12px)",
          }}
          animate={{
            x: 0,
            opacity: [0, 0.42, 1],
            filter: ["blur(12px)", "blur(7px)", "blur(0px)"],
          }}
          transition={{
            delay: slice.delay,
            duration: 0.66,
            times: [0, 0.42, 1],
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
      transition={{ delay: 2.18, duration: 0.18 }}
    >
      {WORDMARK.split("").map((letter, index) => {
        const isReel = index < 4;

        return (
          <motion.span
            // Index is safe here because this word is immutable.
            key={`${letter}-${index}`}
            className={isReel ? "entry-wordmark-reel" : "entry-wordmark-assati"}
            initial={{ opacity: 0, x: -12, filter: "blur(10px)" }}
            animate={{
              opacity: [0, 0.38, 1],
              x: 0,
              filter: ["blur(10px)", "blur(5px)", "blur(0px)"],
            }}
            transition={{
              delay: 2.2 + index * 0.072,
              duration: 0.52,
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
    const frame = requestAnimationFrame(() => setPhase("playing"));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setTimeout(finish, reducedMotion ? 350 : TOTAL_DURATION_MS);
    const failSafe = window.setTimeout(
      finish,
      reducedMotion ? 700 : TOTAL_DURATION_MS + 600,
    );
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(failSafe);
    };
  }, [finish, phase, reducedMotion]);

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
      animate={{ opacity: [1, 1, 0] }}
      transition={{
        duration: 4,
        times: [0, 0.92, 1],
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <span className="sr-only">Opening REELassati Studio</span>
      <div className="entry-lockup-stage">
        <AnimatedMark />
        <AnimatedWordmark />
      </div>
    </motion.div>
  );
}
