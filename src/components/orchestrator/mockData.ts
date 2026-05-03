// Mock data for the multi-client orchestrator.

export type AgentStage = "analyze" | "script" | "edit" | "publish" | "analytics";

export const STAGES: { id: AgentStage; label: string; color: string }[] = [
  { id: "analyze",   label: "Analyze",   color: "265 70% 60%" },
  { id: "script",    label: "Script",    color: "200 80% 55%" },
  { id: "edit",      label: "Edit",      color: "30 85% 55%" },
  { id: "publish",   label: "Publish",   color: "150 65% 45%" },
  { id: "analytics", label: "Analytics", color: "330 70% 55%" },
];

export type JobStatus = "queued" | "running" | "needs_review" | "blocked" | "done";

export type Job = {
  id: string;
  clientId: string;
  clientName: string;
  clientColor: string; // hsl
  title: string;
  stage: AgentStage;
  status: JobStatus;
  progress: number; // 0..1
  etaMin?: number;
  blockedReason?: string;
  predictedScore?: number; // 0..100
  assignee?: string;
  updatedAt: string; // relative
};

export const CLIENTS = [
  { id: "c1", name: "Pizzeria Marco",     color: "20 75% 50%"  },
  { id: "c2", name: "Studio Legale Rossi", color: "215 60% 35%" },
  { id: "c3", name: "Bottega del Caffè",   color: "30 60% 30%"  },
  { id: "c4", name: "FitLab Milano",       color: "150 70% 40%" },
  { id: "c5", name: "Sartoria Bianchi",    color: "340 50% 45%" },
];

export const JOBS: Job[] = [
  // Marco
  { id: "j1", clientId: "c1", clientName: "Pizzeria Marco", clientColor: "20 75% 50%", title: "POV: 72-hour wait — variant B", stage: "analyze", status: "running", progress: 0.62, etaMin: 4, updatedAt: "just now" },
  { id: "j2", clientId: "c1", clientName: "Pizzeria Marco", clientColor: "20 75% 50%", title: "Sourdough origins — long form", stage: "script", status: "needs_review", progress: 1, predictedScore: 78, updatedAt: "12m ago" },
  { id: "j3", clientId: "c1", clientName: "Pizzeria Marco", clientColor: "20 75% 50%", title: "Wood-fired in 90s",            stage: "edit",    status: "queued",       progress: 0,   etaMin: 18, updatedAt: "1h ago" },
  // Rossi
  { id: "j4", clientId: "c2", clientName: "Studio Legale Rossi", clientColor: "215 60% 35%", title: "Privacy GDPR explainer",   stage: "script",  status: "running", progress: 0.44, etaMin: 6, updatedAt: "2m ago" },
  { id: "j5", clientId: "c2", clientName: "Studio Legale Rossi", clientColor: "215 60% 35%", title: "Quarterly recap reel",     stage: "publish", status: "needs_review", progress: 1, updatedAt: "28m ago" },
  // Caffè
  { id: "j6", clientId: "c3", clientName: "Bottega del Caffè",   clientColor: "30 60% 30%",  title: "Single origin tasting #4", stage: "analyze", status: "done",     progress: 1, predictedScore: 91, updatedAt: "3h ago" },
  { id: "j7", clientId: "c3", clientName: "Bottega del Caffè",   clientColor: "30 60% 30%",  title: "Barista hand-off ritual",  stage: "edit",    status: "blocked",  progress: 0.3, blockedReason: "Missing b-roll: pour shot", updatedAt: "5h ago" },
  // FitLab
  { id: "j8", clientId: "c4", clientName: "FitLab Milano",       clientColor: "150 70% 40%", title: "5-min mobility flow",      stage: "publish", status: "running", progress: 0.18, etaMin: 12, updatedAt: "1m ago" },
  { id: "j9", clientId: "c4", clientName: "FitLab Milano",       clientColor: "150 70% 40%", title: "Member transformation",    stage: "analytics", status: "done", progress: 1, predictedScore: 84, updatedAt: "yesterday" },
  // Bianchi
  { id: "j10", clientId: "c5", clientName: "Sartoria Bianchi",   clientColor: "340 50% 45%", title: "Bespoke fitting walkthrough", stage: "script",  status: "queued", progress: 0, etaMin: 9, updatedAt: "20m ago" },
  { id: "j11", clientId: "c5", clientName: "Sartoria Bianchi",   clientColor: "340 50% 45%", title: "Hand-stitching close-up",     stage: "analyze", status: "needs_review", progress: 1, predictedScore: 67, updatedAt: "44m ago" },
];

export type WorkloadCell = { day: string; hour: number; load: number /* 0..1 */ };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function buildWorkload(): WorkloadCell[] {
  const cells: WorkloadCell[] = [];
  for (let d = 0; d < DAYS.length; d++) {
    for (let h = 6; h < 23; h++) {
      const base = Math.sin((h - 6) / 4) * 0.4 + 0.4;
      const dayBoost = d < 5 ? 0.25 : -0.1;
      const noise = ((Math.cos(d * 3 + h * 1.7) + 1) / 2) * 0.25;
      cells.push({ day: DAYS[d], hour: h, load: Math.max(0, Math.min(1, base + dayBoost + noise - 0.2)) });
    }
  }
  return cells;
}

export const SCHEDULE_DAYS = DAYS;

export type AgentLoad = {
  stage: AgentStage;
  active: number;
  queued: number;
  capacityPct: number; // 0..100
};

export const AGENT_LOADS: AgentLoad[] = [
  { stage: "analyze",   active: 2, queued: 4, capacityPct: 62 },
  { stage: "script",    active: 2, queued: 3, capacityPct: 48 },
  { stage: "edit",      active: 1, queued: 5, capacityPct: 84 },
  { stage: "publish",   active: 1, queued: 2, capacityPct: 35 },
  { stage: "analytics", active: 0, queued: 1, capacityPct: 18 },
];
