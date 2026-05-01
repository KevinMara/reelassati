// Mock data + generators for the Scriptwriter agent.

export type Beat = {
  id: string;
  /** seconds, relative to start */
  t: number;
  /** seconds */
  dur: number;
  type: "hook" | "setup" | "payoff" | "twist" | "cta";
  title: string;
  voiceover: string;
  onScreen: string;
  visual: string;
  /** 0..100 — predicted attention drop if this beat is removed */
  weight: number;
};

export type ScriptVariant = {
  id: string;
  label: string;
  /** one-line angle */
  angle: string;
  /** predicted virality score 0-100 */
  score: number;
  /** mock cohort comparison */
  cohortRank: string;
  beats: Beat[];
  /** estimated retention curve, 30 samples 0..1 */
  retention: number[];
  /** identified rhetorical device */
  device: string;
  warnings: string[];
};

const BASE_BEATS: Beat[] = [
  {
    id: "b1",
    t: 0,
    dur: 2.2,
    type: "hook",
    title: "Pattern interrupt",
    voiceover: "Stop scrolling — this changes everything you thought about pizza.",
    onScreen: "WAIT.",
    visual: "Tight close-up, hand pulls cheese, jump cut to dough slap.",
    weight: 92,
  },
  {
    id: "b2",
    t: 2.2,
    dur: 4.5,
    type: "setup",
    title: "The claim",
    voiceover: "Most pizzerias prove dough for 24 hours. We do 72. Here's what that does.",
    onScreen: "72 hours.",
    visual: "Time-lapse of dough rising, on-counter clock dissolves.",
    weight: 70,
  },
  {
    id: "b3",
    t: 6.7,
    dur: 5.8,
    type: "payoff",
    title: "Visual proof",
    voiceover: "The crust is airy, blistered, almost fragile. Listen to it.",
    onScreen: "(crunch)",
    visual: "Slow-mo bite, crackle audio peaks. Steam.",
    weight: 88,
  },
  {
    id: "b4",
    t: 12.5,
    dur: 3.6,
    type: "twist",
    title: "Reframe",
    voiceover: "But the real secret isn't the time. It's the flour we don't import.",
    onScreen: "Local. Stone-milled.",
    visual: "Slow zoom on miller's hands, rural Italy b-roll.",
    weight: 64,
  },
  {
    id: "b5",
    t: 16.1,
    dur: 2.9,
    type: "cta",
    title: "Soft CTA",
    voiceover: "Save this for next Friday.",
    onScreen: "Friday. Save it.",
    visual: "End card, brand mark fades in over plate.",
    weight: 55,
  },
];

function gauss(x: number, mu: number, sig: number) {
  return Math.exp(-((x - mu) ** 2) / (2 * sig * sig));
}

function makeRetention(seed: number): number[] {
  // Start at 1.0, decay with bumps at the hook + payoff
  return Array.from({ length: 30 }, (_, i) => {
    const x = i / 29;
    const decay = Math.max(0, 1 - x * (0.55 + (seed % 7) * 0.02));
    const hookBump = gauss(x, 0.05, 0.06) * 0.05;
    const payoffBump = gauss(x, 0.45, 0.08) * 0.08;
    return Math.max(0.1, Math.min(1, decay + hookBump + payoffBump));
  });
}

export function generateVariants(brief: { goal: string; angle: string }): ScriptVariant[] {
  const angles = [
    {
      label: "The contrarian",
      angle: "Most people get this wrong. Here's the boring truth.",
      device: "Pattern interrupt → reframe",
      score: 86,
      rank: "Top 8% in pizza_food cohort",
      warnings: [],
    },
    {
      label: "The intimate proof",
      angle: "I almost didn't film this. But it's worth it.",
      device: "Para-social opener → sensory proof",
      score: 79,
      rank: "Top 22%",
      warnings: ["Hook may underperform on cold accounts (<5k followers)."],
    },
    {
      label: "The sensory open",
      angle: "Sound on. That's the entire script.",
      device: "ASMR hook → no VO until 3s",
      score: 74,
      rank: "Top 31%",
      warnings: ["Requires clean on-set audio. Risky for noisy kitchens."],
    },
  ];

  return angles.map((a, i) => ({
    id: `v${i + 1}`,
    label: a.label,
    angle: a.angle,
    score: a.score,
    cohortRank: a.rank,
    device: a.device,
    warnings: a.warnings,
    retention: makeRetention(i),
    beats: BASE_BEATS.map((b, j) => ({
      ...b,
      id: `${i}_${b.id}`,
      // Slight variation per variant
      voiceover:
        i === 1 && j === 0
          ? "I almost didn't post this. But you need to see how this dough behaves."
          : i === 2 && j === 0
            ? "(silence) — listen."
            : b.voiceover,
      onScreen: i === 2 && j === 0 ? "🔊" : b.onScreen,
    })),
  }));
}

export const TONE_PRESETS = [
  "Calm authority",
  "Witty",
  "Documentary",
  "Para-social",
  "Bold",
  "Educational",
];

export const FORMAT_PRESETS = ["Talking head", "B-roll only", "Voice-over", "Skit", "Unboxing"];

export const PLATFORM_PRESETS = ["Reels", "TikTok", "Shorts"];
