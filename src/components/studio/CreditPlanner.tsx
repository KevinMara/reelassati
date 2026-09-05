import { useState } from "react";
import {
  AI_CREDIT_COSTS,
  PLAN_IDS,
  PLAN_NAME_BY_ID,
  planEntitlements,
} from "@contracts/billing";

const ACTIVITIES = [
  {
    key: "scripts",
    label: "Scripts",
    cost: AI_CREDIT_COSTS.script,
    initial: 10,
  },
  {
    key: "images",
    label: "Images · 1K",
    cost: AI_CREDIT_COSTS.image1K,
    initial: 10,
  },
  {
    key: "voice",
    label: "Voice · 1,000 characters",
    cost: AI_CREDIT_COSTS.speechPerThousandCharacters,
    initial: 2,
  },
  {
    key: "video",
    label: "Video · 5s, 720p, no audio",
    cost: AI_CREDIT_COSTS.video720pPerSecond * 5,
    initial: 2,
  },
  { key: "research", label: "Research · one platform", cost: 8, initial: 4 },
];
export function CreditPlanner() {
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(ACTIVITIES.map(a => [a.key, a.initial]))
  );
  const total = ACTIVITIES.reduce(
    (sum, a) => sum + (counts[a.key] || 0) * a.cost,
    0
  );
  const fit = PLAN_IDS.find(id => planEntitlements(id).monthlyCredits >= total);
  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-surface p-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Plan your creative month</h2>
          <p className="mt-2 text-sm text-foreground/70">
            Try a mix of work. The total updates as you go.
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums text-primary">
            {total.toLocaleString()} <span className="text-sm">credits</span>
          </p>
          <p className="mt-1 text-sm">
            {fit ? `Fits in ${PLAN_NAME_BY_ID[fit]}` : "Studio + top-ups"}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ACTIVITIES.map(a => (
          <label key={a.key} className="text-sm">
            <span className="block min-h-10 text-foreground/80">{a.label}</span>
            <input
              type="number"
              min={0}
              max={1000}
              inputMode="numeric"
              value={counts[a.key]}
              onChange={e =>
                setCounts(c => ({
                  ...c,
                  [a.key]: Math.max(
                    0,
                    Math.min(1000, Math.floor(Number(e.target.value) || 0))
                  ),
                }))
              }
              className="mt-2 w-full rounded-lg border border-border bg-background p-3 font-medium"
            />
            <span className="mt-2 block text-xs text-foreground/65">
              {((counts[a.key] || 0) * a.cost).toLocaleString()} credits
            </span>
          </label>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {PLAN_IDS.map(id => {
          const allowance = planEntitlements(id).monthlyCredits;
          return (
            <div
              key={id}
              className={`rounded-xl border p-3 ${fit === id ? "border-primary/50 bg-primary/10" : "border-border bg-background/50"}`}
            >
              <div className="flex justify-between text-sm">
                <span>{PLAN_NAME_BY_ID[id]}</span>
                <span>
                  {total <= allowance
                    ? `${(allowance - total).toLocaleString()} left`
                    : `${(total - allowance).toLocaleString()} extra`}
                </span>
              </div>
              <progress
                className="mt-3 h-1.5 w-full accent-primary"
                max={allowance}
                value={Math.min(total, allowance)}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-foreground/70">
        An estimate using the settings above. Duration, resolution, audio, and
        continuation change video costs. Manual editing and MP4 export use no AI
        credits.
      </p>
    </section>
  );
}
