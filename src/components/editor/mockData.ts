// Mock data for the Editor agent.

export type ClipKind = "video" | "broll";
export type Clip = {
  id: string;
  kind: ClipKind;
  start: number; // seconds on master timeline
  duration: number;
  label: string;
  /** color hint for the timeline block */
  hue: number;
  /** thumbnail position */
  thumb: string;
};

export type Caption = {
  id: string;
  start: number;
  duration: number;
  text: string;
  emphasis?: "none" | "bold" | "shake";
};

export type SfxEvent = {
  id: string;
  t: number;
  label: string;
  /** intensity 0..1 */
  intensity: number;
};

export type MusicTrack = {
  id: string;
  start: number;
  duration: number;
  title: string;
  bpm: number;
};

export type EditorProject = {
  totalDuration: number;
  clips: Clip[];
  captions: Caption[];
  sfx: SfxEvent[];
  music: MusicTrack;
};

export const MOCK_PROJECT: EditorProject = {
  totalDuration: 21,
  clips: [
    { id: "c1", kind: "video", start: 0, duration: 2.2, label: "Hook · cheese pull", hue: 270, thumb: "🍕" },
    { id: "c2", kind: "video", start: 2.2, duration: 4.5, label: "72-hour claim", hue: 280, thumb: "⏱" },
    { id: "c3", kind: "broll", start: 6.7, duration: 2.2, label: "B-roll · oven", hue: 25, thumb: "🔥" },
    { id: "c4", kind: "video", start: 8.9, duration: 3.6, label: "Slow-mo bite", hue: 270, thumb: "😋" },
    { id: "c5", kind: "broll", start: 12.5, duration: 3.6, label: "B-roll · miller", hue: 25, thumb: "🌾" },
    { id: "c6", kind: "video", start: 16.1, duration: 4.9, label: "End card", hue: 200, thumb: "✨" },
  ],
  captions: [
    { id: "cap1", start: 0.2, duration: 1.8, text: "WAIT.", emphasis: "shake" },
    { id: "cap2", start: 2.5, duration: 3.5, text: "72 hours.", emphasis: "bold" },
    { id: "cap3", start: 7.0, duration: 4.5, text: "Listen to it.", emphasis: "none" },
    { id: "cap4", start: 12.8, duration: 3.0, text: "Local. Stone-milled.", emphasis: "bold" },
    { id: "cap5", start: 16.5, duration: 3.5, text: "Friday. Save it.", emphasis: "none" },
  ],
  sfx: [
    { id: "s1", t: 0.1, label: "whoosh", intensity: 0.8 },
    { id: "s2", t: 2.3, label: "tick", intensity: 0.5 },
    { id: "s3", t: 7.2, label: "crunch", intensity: 0.95 },
    { id: "s4", t: 12.6, label: "swell", intensity: 0.6 },
    { id: "s5", t: 16.3, label: "ding", intensity: 0.4 },
  ],
  music: { id: "m1", start: 0, duration: 21, title: "Quiet Authority — 92 BPM", bpm: 92 },
};

export const CAPTION_STYLES = [
  { id: "k1", name: "Karaoke amethyst", preview: "WAIT.", color: "primary" },
  { id: "k2", name: "Bold white serif", preview: "72.", color: "white" },
  { id: "k3", name: "Subtle outline", preview: "listen.", color: "muted" },
  { id: "k4", name: "Shake on impact", preview: "STOP", color: "primary" },
];

export const TRANSITION_PRESETS = ["Hard cut", "J-cut", "Match cut", "Whip pan", "Cross dissolve"];
