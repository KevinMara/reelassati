// ============================================================================
// REELASSATI — Entry Animation Tuning Constants
// Adjust these to fine-tune the "Snap into Focus" loading animation.
// ============================================================================

/** Duration of the curved slide-in (seconds) */
export const SLIDE_DURATION = 0.7;

/** Y arc keyframes for the slide-in */
export const ARC_KEYFRAMES_Y = [0, -30, 0];

/** Y hop keyframes for the jump */
export const HOP_KEYFRAMES_Y = [0, -50, 0];

/** ScaleY squash-stretch keyframes during the hop */
export const SQUASH_KEYFRAMES = [1, 1.15, 0.92, 1];

/** Spring config for the player frame assembling around the triangle */
export const FRAME_SPRING = { stiffness: 280, damping: 18 };

/** Duration of the purple fill sweep (seconds) */
export const FILL_DURATION = 0.4;

/** Spring config for wordmark + player nudge */
export const WORDMARK_SPRING = { stiffness: 220, damping: 22 };

/** How far the player nudges left when wordmark emerges (px) */
export const PLAYER_NUDGE_X = -24;

/** Duration of the wipe reveal (seconds) */
export const WIPE_DURATION = 0.45;

/** Easing curve for the wipe (easeOutExpo-ish) */
export const WIPE_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/** Hard fail-safe cap — overlay NEVER stays longer than this (ms) */
export const MAX_DURATION = 2400;

/** Total estimated animation duration (seconds) — includes 1s hold + zoom */
export const TOTAL_DURATION = 2.8;

/** sessionStorage key to track if animation has played */
export const SESSION_KEY = "entryAnimPlayed";
export const ENTRY_ORIGIN_SCROLL_KEY = "entryOriginScroll";
