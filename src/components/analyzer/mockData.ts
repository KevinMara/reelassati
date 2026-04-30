import { BRAIN_REGIONS } from "@/components/analyzer/NeuralBrainViz";
import type { DimensionData } from "@/components/analyzer/DimensionCard";
import type { Recommendation } from "@/components/analyzer/RecommendationCard";
import type { Marker } from "@/components/analyzer/TimelineScrubber";

export const MOCK_DURATION_S = 32;

export const MOCK_VERDICT = {
  score: 68,
  grade: "B-",
  text:
    "Apertura forte (3.2s), ma cala dopo il quinto secondo: il viso esce dall'inquadratura mentre l'audio resta su un tono didattico. La pizza appare a 9s — troppo tardi per un goal di viralità. Riavvicinare il payoff visivo nei primi 4 secondi alzerebbe il punteggio di ~12 punti.",
  goal: "Virality",
  cohort: 87,
  language: "IT",
  platform: "TikTok",
};

export const MOCK_DIMENSIONS: DimensionData[] = [
  {
    key: "hook",
    name: "Hook strength",
    score: 78,
    confidence: "high",
    reason: "Apertura visiva ad alto contrasto (close-up + audio percussivo a 0.4s).",
    signals: [
      { label: "Visual contrast peak", weight: 0.42, timestamp: "0.4s" },
      { label: "Audio onset density", weight: 0.31, timestamp: "0.0–1.2s" },
      { label: "Face entry", weight: 0.18, timestamp: "0.8s" },
    ],
  },
  {
    key: "retention",
    name: "Retention shape",
    score: 54,
    confidence: "high",
    reason: "Calo netto a 5.2s — il payoff visivo arriva troppo tardi rispetto al cohort.",
    signals: [
      { label: "Visual stagnation", weight: 0.5, timestamp: "5.2–8.4s" },
      { label: "Cut frequency drop", weight: 0.28 },
    ],
  },
  {
    key: "emotion",
    name: "Emotional arc",
    score: 71,
    confidence: "medium",
    reason: "Curva emotiva piatta nella seconda metà; manca un picco di sorpresa.",
    signals: [
      { label: "Pitch variance", weight: 0.34 },
      { label: "Facial expression range", weight: 0.29 },
    ],
  },
  {
    key: "clarity",
    name: "Message clarity",
    score: 82,
    confidence: "high",
    reason: "Tesi chiara entro 2.5s, supportata da caption sincronizzata.",
    signals: [
      { label: "Caption-speech sync", weight: 0.45 },
      { label: "Topic consistency", weight: 0.38 },
    ],
  },
  {
    key: "share",
    name: "Shareability",
    score: 49,
    confidence: "medium",
    reason: "Mancano 'social tokens' (frase memorabile, stat sorprendente, opinione divisiva).",
    signals: [
      { label: "Quotable phrase detection", weight: 0.4 },
      { label: "Controversy axis", weight: 0.22 },
    ],
  },
  {
    key: "platform",
    name: "Platform fit",
    score: 64,
    confidence: "high",
    reason: "Aspect 9:16 corretto, ma ritmo cuts/s sotto la mediana TikTok del cohort.",
    signals: [
      { label: "Cuts per second vs cohort", weight: 0.38 },
      { label: "Caption style match", weight: 0.31 },
    ],
  },
];

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    rank: 1,
    what: "Anticipa il payoff della pizza al secondo 3 invece che al 9",
    why: "Il cohort di pizza_food viral mostra il payoff visivo entro 3.5s nell'88% dei casi top-quartile.",
    expectedImpact: 12,
    how: [
      "Sposta il close-up della pizza in apertura.",
      "Tieni la frase didattica come voiceover sopra il visual.",
      "Riduci il primo cut da 1.8s a 0.9s.",
    ],
    difficulty: "easy",
    confidence: "high",
  },
  {
    rank: 2,
    what: "Aggiungi una caption-token memorabile nei primi 2 secondi",
    why: "I video con frasi quotabili in apertura ricevono +34% di share rate nel cohort.",
    expectedImpact: 8,
    how: [
      "Estrai la frase più forte dello script attuale ('migliore di Roma').",
      "Posizionala a schermo a 0.6s con stile bold + outline.",
      "Mantienila visibile ~1.4s.",
    ],
    difficulty: "easy",
    confidence: "high",
  },
  {
    rank: 3,
    what: "Crea un picco emotivo di sorpresa intorno al secondo 18",
    why: "La curva emotiva è piatta dopo i 12s — è il momento in cui si perde il 22% degli spettatori.",
    expectedImpact: 7,
    how: [
      "Inserisci un cut hard su una reazione (mordere, occhi, stop & smile).",
      "Aumenta il pitch della voce di +2 semitoni in quel beat.",
      "SFX whoosh leggero a 17.6s.",
    ],
    difficulty: "medium",
    confidence: "medium",
  },
  {
    rank: 4,
    what: "Stringi i cuts: target 1.8 cuts/s, ora sei a 1.1",
    why: "Cohort top-quartile su TikTok IT food = 1.6–2.0 cuts/s.",
    expectedImpact: 5,
    how: [
      "Riduci la durata media del clip da 0.91s a 0.55s.",
      "Mantieni i due close-up sopra la mediana per ancoraggio.",
    ],
    difficulty: "medium",
    confidence: "high",
  },
  {
    rank: 5,
    what: "Termina con un loop visivo per riavviare il watch",
    why: "I video che chiudono con un frame simile all'apertura ottengono +18% di completion.",
    expectedImpact: 4,
    how: [
      "Riusa il primo frame come ultimo frame.",
      "Audio cut secco invece di fade-out.",
    ],
    difficulty: "easy",
    confidence: "medium",
  },
];

export const MOCK_MARKERS: Marker[] = [
  { t: 0.4, type: "good", label: "Strong opening contrast" },
  { t: 3.2, type: "goal", label: "Hook complete" },
  { t: 5.2, type: "bad", label: "Attention drop" },
  { t: 9.0, type: "miss", label: "Payoff late" },
  { t: 14.5, type: "spike", label: "Emotional micro-peak" },
  { t: 22.5, type: "good", label: "Reaction shot lands" },
  { t: 29.0, type: "miss", label: "Weak ending" },
];

// Mock per-region intensities for the brain — stable but varied
export const MOCK_REGION_INTENSITIES = BRAIN_REGIONS.map((_, i) => {
  const v = Math.abs(Math.sin(i * 1.7 + 2.3)) * 0.7 + 0.15;
  return Math.min(1, v);
});

export const MOCK_PROCESSING_STAGES = [
  { key: "download", durationS: 1.5 },
  { key: "extract", durationS: 2.5 },
  { key: "transcribe", durationS: 3 },
  { key: "neural", durationS: 12 },
  { key: "regions", durationS: 3 },
  { key: "cohort", durationS: 4 },
  { key: "scorecard", durationS: 2 },
  { key: "recs", durationS: 2 },
];
