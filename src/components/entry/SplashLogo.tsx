/**
 * SplashLogo — Single inline SVG for the entry animation.
 *
 * CRITICAL: This SVG contains EXACTLY ONE triangle (id="triangle").
 * The triangle and the play button's triangle are the SAME path.
 * The player frame (id="player-frame") animates IN around the existing triangle.
 * The wordmark is positioned BEHIND the player in z-order.
 *
 * Anti-bug: Assert only one #triangle node exists during the splash.
 */

interface SplashLogoProps {
  className?: string;
}

// The triangle path from the site's existing Logo.tsx (viewBox 0 0 32 32)
// Scaled to our animation viewBox: M36 36 L36 68 L64 52 Z
const TRIANGLE_D = "M36 36 L36 68 L64 52 Z";

export default function SplashLogo({ className }: SplashLogoProps) {
  return (
    <svg
      width="320"
      height="100"
      viewBox="0 0 320 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* ── Wordmark layer (behind player in z-order) ── */}
      <g id="wordmark" transform="translate(88, 30)">
        {/* "REEL" — bold uppercase */}
        <text
          x="0"
          y="32"
          fontFamily="'Geist', -apple-system, sans-serif"
          fontWeight="700"
          fontSize="28"
          letterSpacing="0.02em"
          fill="var(--anim-text)"
          className="select-none"
        >
          REEL
        </text>
        {/* "assati" — serif italic */}
        <text
          x="68"
          y="32"
          fontFamily="'Fraunces', Georgia, serif"
          fontWeight="400"
          fontStyle="italic"
          fontSize="26.5"
          fill="var(--anim-text)"
          className="select-none"
        >
          assati
        </text>
      </g>

      {/* ── Player + triangle group ── */}
      <g id="player-group" transform="translate(20, 10)">
        {/* Player frame — rounded square that assembles around the triangle */}
        <g id="player-frame" transform="translate(0, 0)">
          {/* Outer rounded rectangle (player body) */}
          <rect
            x="8"
            y="8"
            width="72"
            height="72"
            rx="18"
            ry="18"
            fill="transparent"
            stroke="var(--anim-purple)"
            strokeWidth="3"
            className="entry-player-frame-outline"
          />
          {/* Fill layer — starts scaleY:0, sweeps to full */}
          <rect
            x="8"
            y="8"
            width="72"
            height="72"
            rx="18"
            ry="18"
            fill="var(--anim-purple)"
            className="entry-player-fill"
            style={{ transformOrigin: "44px 80px" }}
          />
        </g>

        {/* ── THE ONE TRIANGLE ──
            This is the ONLY triangle in the entire splash.
            It persists from slide-in through hop through morph.
            The player frame assembles AROUND it.
        */}
        <g id="triangle" transform="translate(0, 0)">
          {/* Triangle outline (visible during slide/hop, before fill) */}
          <path
            d={TRIANGLE_D}
            fill="none"
            stroke="var(--anim-purple)"
            strokeWidth="3"
            strokeLinejoin="round"
            className="entry-triangle-outline"
          />
          {/* Triangle fill (same path, recolors on purple fill phase) */}
          <path
            d={TRIANGLE_D}
            fill="var(--anim-purple)"
            className="entry-triangle-fill"
          />
        </g>
      </g>
    </svg>
  );
}

// Re-export the triangle path for the animation controller
export { TRIANGLE_D };
