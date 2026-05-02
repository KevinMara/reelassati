// Mock data for the Publisher agent.

export type Platform = "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin";

export type PlatformMeta = {
  id: Platform;
  name: string;
  color: string; // hsl
  handle: string;
  charLimit: number;
  hashtagSweet: [number, number]; // min, max
  bestSlots: string[]; // ISO-ish day-hour labels
};

export const PLATFORMS: PlatformMeta[] = [
  { id: "instagram", name: "Instagram", color: "330 80% 60%", handle: "@pizzeria.molino", charLimit: 2200, hashtagSweet: [8, 15], bestSlots: ["Tue 19:00", "Thu 12:30", "Sat 11:00"] },
  { id: "tiktok",    name: "TikTok",    color: "200 90% 55%", handle: "@molino.pizza",    charLimit: 2200, hashtagSweet: [3, 6],   bestSlots: ["Wed 21:00", "Fri 19:30", "Sun 14:00"] },
  { id: "youtube",   name: "YouTube",   color: "0 75% 55%",   handle: "Molino Reels",     charLimit: 5000, hashtagSweet: [2, 4],   bestSlots: ["Sat 09:00", "Sun 18:00"] },
  { id: "facebook",  name: "Facebook",  color: "220 80% 55%", handle: "Pizzeria Molino",  charLimit: 63206, hashtagSweet: [1, 3],  bestSlots: ["Wed 12:00", "Sun 19:00"] },
  { id: "linkedin",  name: "LinkedIn",  color: "210 65% 40%", handle: "Pizzeria Molino",  charLimit: 3000, hashtagSweet: [3, 5],   bestSlots: ["Tue 08:30", "Thu 17:00"] },
];

export type CaptionVariant = {
  id: string;
  platform: Platform;
  text: string;
  hashtags: string[];
  predictedReach: number; // 0..100 index
};

export const MOCK_REEL = {
  title: "The contrarian — v1",
  thumb: "🍕",
  hue: 270,
  duration: 21,
};

export const CAPTIONS: CaptionVariant[] = [
  {
    id: "ig-1",
    platform: "instagram",
    text: "72 ore. Niente lieviti rapidi. Solo grano locale e pazienza.\n\nVieni venerdì — ne facciamo solo 40.",
    hashtags: ["#pizzanapoletana", "#lievitazione72ore", "#pizzaartigianale", "#molinolocale", "#pizzeriaitaliana", "#pizzalovers", "#stonemilled", "#slowfood", "#pizzeria", "#pizzaitalia"],
    predictedReach: 78,
  },
  {
    id: "tt-1",
    platform: "tiktok",
    text: "POV: la tua pizza ha lievitato 72 ore 🍕⏱️ #pizzatok",
    hashtags: ["#pizzatok", "#fyp", "#italianfood", "#pizzanapoletana"],
    predictedReach: 84,
  },
  {
    id: "yt-1",
    platform: "youtube",
    text: "Why we wait 72 hours before baking a single pizza. #shorts",
    hashtags: ["#shorts", "#pizza", "#italy"],
    predictedReach: 62,
  },
  {
    id: "fb-1",
    platform: "facebook",
    text: "Ogni venerdì, 40 pizze. Lievitazione 72 ore, grano del mulino qui sotto. Prenota un tavolo dal link in bio.",
    hashtags: ["#pizzeria", "#milano"],
    predictedReach: 41,
  },
  {
    id: "li-1",
    platform: "linkedin",
    text: "Why we changed our entire prep cycle to 72 hours — and what it taught us about patience as a competitive advantage.",
    hashtags: ["#smallbusiness", "#hospitality", "#craftsmanship"],
    predictedReach: 35,
  },
];

export type ScheduleSlot = {
  day: string; // "Mon" .. "Sun"
  hour: number; // 0-23
  score: number; // 0..1 — heat
  isBest?: boolean;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function buildHeatmap(platform: Platform): ScheduleSlot[] {
  const meta = PLATFORMS.find((p) => p.id === platform)!;
  const slots: ScheduleSlot[] = [];
  // simulate per-platform heatmap (deterministic from name length)
  const seed = meta.name.length;
  for (let d = 0; d < 7; d++) {
    for (let h = 6; h < 24; h++) {
      // base curve: peaks at lunch (12-13) and evening (19-21)
      const lunch = Math.exp(-Math.pow(h - 12.5, 2) / 4);
      const evening = Math.exp(-Math.pow(h - 20, 2) / 5);
      const weekend = d >= 5 ? 1.15 : 1;
      const noise = ((Math.sin(d * 7 + h * 3 + seed) + 1) / 2) * 0.25;
      const score = Math.min(1, (lunch * 0.55 + evening * 0.85 + noise) * weekend * 0.85);
      slots.push({ day: DAYS[d], hour: h, score });
    }
  }
  // mark best slots
  meta.bestSlots.forEach((s) => {
    const [day, time] = s.split(" ");
    const hour = parseInt(time.split(":")[0]);
    const slot = slots.find((x) => x.day === day && x.hour === hour);
    if (slot) { slot.isBest = true; slot.score = 1; }
  });
  return slots;
}

export const DAYS_ORDER = DAYS;
