import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SESSION_KEY } from "./entry-constants";
import "./entry-animation.css";

export interface EntryAnimationProps {
  force?: boolean;
  onComplete?: () => void;
}

export function hasEntryPlayed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function markEntryPlayed(): void {
  if (typeof window !== "undefined") sessionStorage.setItem(SESSION_KEY, "1");
}

export default function EntryAnimation({
  force = false,
  onComplete,
}: EntryAnimationProps) {
  const [phase, setPhase] = useState<"hidden" | "ready" | "playing" | "done">(
    () => (force || !hasEntryPlayed() ? "ready" : "done"),
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
    const timer = window.setTimeout(finish, reducedMotion ? 350 : 4_250);
    const failSafe = window.setTimeout(finish, reducedMotion ? 700 : 5_000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(failSafe);
    };
  }, [finish, phase, reducedMotion]);

  if (phase === "hidden" || phase === "done") return null;

  if (reducedMotion) {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ backgroundColor: "var(--anim-bg)" }}
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
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "var(--anim-bg)" }}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{
        duration: 4.05,
        times: [0, 0.83, 1],
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <span className="sr-only">Opening REELassati Studio</span>

      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 0.45, 0], scale: [0.7, 1.35, 1.65] }}
        transition={{ delay: 1.45, duration: 0.55, ease: "easeOut" }}
      >
        <div
          className="w-96 h-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, var(--anim-glow), transparent 70%)",
          }}
        />
      </motion.div>

      <motion.div
        className="relative flex items-center"
        initial={{ scale: 1, y: 0 }}
        animate={{ scale: [1, 1, 7.5], y: [0, 0, 24] }}
        transition={{
          duration: 4,
          times: [0, 0.79, 1],
          ease: [0.72, 0, 0.25, 1],
        }}
      >
        <motion.div
          className="absolute left-[86px] top-1/2 -translate-y-1/2 overflow-hidden"
          initial={{ clipPath: "inset(0 100% 0 0)", x: -72, opacity: 0 }}
          animate={{ clipPath: "inset(0 0% 0 0)", x: 0, opacity: 1 }}
          transition={{ delay: 1.95, duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="flex items-baseline leading-none whitespace-nowrap pl-10">
            <span
              className="font-bold uppercase tracking-[0.02em] text-[64px]"
              style={{
                color: "var(--anim-text)",
                fontFamily: "'Geist', sans-serif",
              }}
            >
              REEL
            </span>
            <span
              className="italic font-normal -ml-[0.04em]"
              style={{
                color: "var(--anim-text)",
                fontFamily: "'Fraunces', serif",
                fontSize: "60px",
              }}
            >
              assati
            </span>
          </span>
        </motion.div>

        <motion.div
          className="relative entry-player"
          initial={{ x: 0 }}
          animate={{ x: -42 }}
          transition={{
            delay: 1.95,
            type: "spring",
            stiffness: 240,
            damping: 24,
          }}
        >
          <motion.img
            src="/brand/reelassati-mark-transparent.png"
            alt=""
            aria-hidden="true"
            width="240"
            height="240"
            className="block rounded-[20%]"
            initial={{ x: -170, y: 14, rotate: -12, opacity: 0 }}
            animate={{ x: 0, y: [14, -10, 0, -14, 0], rotate: 0, opacity: 1 }}
            transition={{
              duration: 1.68,
              times: [0, 0.35, 0.58, 0.76, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function StaticLockup() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/brand/reelassati-mark-transparent.png"
        alt=""
        width="48"
        height="48"
        aria-hidden="true"
        className="rounded-[20%]"
      />
      <span className="flex items-baseline leading-none">
        <span
          className="font-bold uppercase tracking-[0.02em] text-2xl"
          style={{ color: "var(--anim-text)", fontFamily: "'Geist', sans-serif" }}
        >
          REEL
        </span>
        <span
          className="italic font-normal -ml-[0.04em]"
          style={{
            color: "var(--anim-text)",
            fontFamily: "'Fraunces', serif",
            fontSize: "1.35rem",
          }}
        >
          assati
        </span>
      </span>
    </div>
  );
}
