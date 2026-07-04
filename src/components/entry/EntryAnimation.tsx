import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  SESSION_KEY,
} from "./entry-constants";
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

export default function EntryAnimation({ force = false, onComplete }: EntryAnimationProps) {
  const [phase, setPhase] = useState<"hidden" | "ready" | "playing" | "done">("hidden");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    if (force || !hasEntryPlayed()) {
      setPhase("ready");
      document.documentElement.style.overflow = "hidden";
    } else {
      setPhase("done");
      onCompleteRef.current?.();
    }
    return () => { document.documentElement.style.overflow = ""; };
  }, [force]);

  useEffect(() => {
    if (phase !== "ready") return;
    const r = requestAnimationFrame(() => setPhase("playing"));
    return () => cancelAnimationFrame(r);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (reducedMotion) {
      const t = setTimeout(() => finish(), 300);
      return () => clearTimeout(t);
    }
    // HARD 10 SECOND TIMER — all phases + wipe + buffer
    const timer = setTimeout(() => finish(), 10000);
    const failSafe = setTimeout(() => finish(), 12000); // must be > timer
    return () => { clearTimeout(timer); clearTimeout(failSafe); };
  }, [phase, reducedMotion]);

  const finish = useCallback(() => {
    document.documentElement.style.overflow = "";
    markEntryPlayed();
    setPhase("done");
    onCompleteRef.current?.();
  }, []);

  if (phase === "hidden" || phase === "done") return null;

  if (reducedMotion) {
    return (
      <motion.div
        role="status" aria-live="polite"
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ backgroundColor: "var(--anim-bg)" }}
        initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.25 }}
      >
        <span className="sr-only">Loading dashboard</span>
        <StaticLockup />
      </motion.div>
    );
  }

  // NO AnimatePresence — just a fixed overlay that wipes at the end
  return (
    <div
      role="status" aria-live="polite"
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "var(--anim-bg)" }}
    >
      <span className="sr-only">Loading dashboard</span>

      {/* Wipe layer — slides up at 5.0s */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--anim-bg)" }}
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        transition={{ delay: 7.0, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Bloom */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: "var(--anim-bloom-opacity, 0)" }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.5, 0], scale: [0.6, 1.4, 1.6] }}
        transition={{ delay: 2.5, duration: 0.4, ease: "easeOut" }}
      >
        <div className="w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle, var(--anim-glow), transparent 70%)" }} />
      </motion.div>

      {/* Lockup */}
      <div className="relative flex items-center">

        {/* Wordmark — reveals at 3.5s */}
        <motion.div
          className="absolute left-[90px] top-1/2 -translate-y-1/2 overflow-hidden"
          initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
          animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
          transition={{ delay: 3.5, duration: 0.8, ease: "easeOut" }}
        >
          <span className="flex items-baseline leading-none whitespace-nowrap pl-10">
            <span className="font-bold uppercase tracking-[0.02em] text-[64px]" style={{ color: "var(--anim-text)", fontFamily: "'Geist',sans-serif" }}>REEL</span>
            <span className="italic font-normal -ml-[0.04em]" style={{ color: "var(--anim-text)", fontFamily: "'Fraunces',serif", fontSize: "60px" }}>assati</span>
          </span>
        </motion.div>

        {/* Player — nudges left at 3.5s */}
        <motion.div
          className="relative"
          initial={{ x: 0 }}
          animate={{ x: -40 }}
          transition={{ delay: 3.5, type: "spring", stiffness: 220, damping: 22 }}
        >
          <svg width="240" height="240" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(10,10)">

              {/* STEP 4 (2.0s): Circle outline draws on */}
              <motion.circle
                cx="50" cy="50" r="46"
                fill="none"
                stroke="var(--anim-purple)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 2.0, duration: 0.5, ease: "easeInOut" }}
              />

              {/* STEP 5 (2.5s): Purple fill sweeps from bottom */}
              <motion.circle
                cx="50" cy="50" r="46"
                fill="var(--anim-purple)"
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: 2.5, duration: 0.5, ease: "easeOut" }}
                style={{ transformOrigin: "50px 96px" }}
              />

              {/* STEP 6 (3.0s): Arc + dot fade in */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 3.0, duration: 0.4, ease: "easeOut" }}
              >
                <path d="M28 56 C 38 74, 56 80, 75 63" stroke="var(--anim-bg)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                <circle cx="75" cy="63" r="5" fill="var(--anim-bg)" />
              </motion.g>

              {/* STEPS 1-3: THE ONE TRIANGLE — slides in alone, arcs up-then-down */}
              <motion.g
                id="triangle"
                initial={{ x: -200, y: 0, rotate: -10 }}
                animate={{ x: 0, y: [0, -30, 0], rotate: 0 }}
                transition={{
                  x: { duration: 1.5, ease: "easeOut" },
                  y: { duration: 1.5, ease: "easeInOut", times: [0, 0.5, 1] },
                  rotate: { duration: 1.5, ease: "easeOut" },
                }}
              >
                {/* Hop at 2.0s */}
                <motion.g
                  initial={{ y: 0, scaleY: 1 }}
                  animate={{ y: [0, -30, 0], scaleY: [1, 1.15, 0.92, 1] }}
                  transition={{
                    y: { delay: 2.0, duration: 0.3, ease: "easeOut", times: [0, 0.5, 1] },
                    scaleY: { delay: 2.0, duration: 0.3, times: [0, 0.3, 0.7, 1] },
                  }}
                >
                  <motion.path
                    d="M14 14 L14 70 L66 42 Z"
                    fill="none"
                    stroke="var(--anim-purple)"
                    strokeWidth="5"
                    strokeLinejoin="round"
                    initial={{ strokeOpacity: 1 }}
                    animate={{ strokeOpacity: 0 }}
                    transition={{ delay: 2.5, duration: 0.4 }}
                  />
                  <motion.path
                    d="M14 14 L14 70 L66 42 Z"
                    fill="var(--anim-bg)"
                    initial={{ fillOpacity: 0 }}
                    animate={{ fillOpacity: 1 }}
                    transition={{ delay: 2.5, duration: 0.4 }}
                  />
                </motion.g>
              </motion.g>

            </g>
          </svg>
        </motion.div>
      </div>
    </div>
  );
}

function StaticLockup() {
  return (
    <div className="flex items-center gap-3">
      <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="15" fill="var(--anim-purple)" />
        <path d="M9 9 L9 17 L16 13 Z" fill="var(--anim-bg)" />
        <path d="M9 17 C 12 22, 18 24, 24 19" stroke="var(--anim-bg)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <circle cx="24" cy="19" r="1.6" fill="var(--anim-bg)" />
      </svg>
      <span className="flex items-baseline leading-none">
        <span className="font-bold uppercase tracking-[0.02em] text-2xl" style={{ color: "var(--anim-text)", fontFamily: "'Geist',sans-serif" }}>REEL</span>
        <span className="italic font-normal -ml-[0.04em]" style={{ color: "var(--anim-text)", fontFamily: "'Fraunces',serif", fontSize: "1.35rem" }}>assati</span>
      </span>
    </div>
  );
}
