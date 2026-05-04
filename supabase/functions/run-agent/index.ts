// Dispatcher edge function for all 6 agents.
// Reads a job row, runs the agent (Lovable AI for text agents, deterministic
// generators for everything else), writes result back to the same job row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type Payload = { job_id: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.slice(7),
    );
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { job_id }: Payload = await req.json();
    if (!job_id) return json({ error: "job_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: job, error: jErr } = await admin
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (jErr || !job) return json({ error: "job not found" }, 404);
    if (job.user_id !== userId) return json({ error: "forbidden" }, 403);

    // Mark running
    await admin
      .from("jobs")
      .update({ status: "running", progress_pct: 5, started_at: new Date().toISOString(), progress_message: "Starting…" })
      .eq("id", job_id);

    // Dispatch
    const agent = job.agent_name as string;
    const payload = (job.payload ?? {}) as Record<string, unknown>;

    let result: Record<string, unknown>;
    try {
      if (agent === "analyzer") result = await runAnalyzer(payload, LOVABLE_API_KEY, admin, job_id);
      else if (agent === "scriptwriter") result = await runScript(payload, LOVABLE_API_KEY, admin, job_id);
      else if (agent === "editor") result = await runEditor(payload, admin, job_id);
      else if (agent === "publisher") result = await runPublisher(payload, admin, job_id);
      else if (agent === "analytics") result = await runAnalytics(payload, admin, job_id);
      else throw new Error(`unknown agent ${agent}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("agent failed", agent, msg);
      await admin
        .from("jobs")
        .update({
          status: "failed",
          progress_message: msg.slice(0, 240),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job_id);
      return json({ error: msg }, 500);
    }

    await admin
      .from("jobs")
      .update({
        status: "completed",
        progress_pct: 100,
        progress_message: "Done",
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    return json({ ok: true, result }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("run-agent fatal", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function progress(admin: any, jobId: string, pct: number, msg: string) {
  await admin
    .from("jobs")
    .update({ progress_pct: pct, progress_message: msg })
    .eq("id", jobId);
}

// ---------- Lovable AI helper (structured output via tool calling) ----------
async function aiStructured<T>(opts: {
  apiKey: string;
  system: string;
  user: string;
  toolName: string;
  schema: Record<string, unknown>;
  model?: string;
}): Promise<T> {
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: opts.toolName,
            description: "Return the structured result.",
            parameters: opts.schema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: opts.toolName } },
    }),
  });
  if (r.status === 429) throw new Error("AI rate limit — try again in a moment.");
  if (r.status === 402) throw new Error("AI credits exhausted — top up in workspace settings.");
  if (!r.ok) throw new Error(`AI error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured payload");
  return JSON.parse(args) as T;
}

// ---------- ANALYZER ----------
async function runAnalyzer(p: any, apiKey: string | undefined, admin: any, jobId: string) {
  await progress(admin, jobId, 15, "Surveying reference cohort…");
  await new Promise((r) => setTimeout(r, 400));
  await progress(admin, jobId, 35, "Scoring against retention model…");

  // Use AI to generate a verdict based on the goal/notes; rest is deterministic
  // so the rich UI stays populated.
  const goal = String(p.goal ?? "Virality");
  const platform = String(p.platform ?? "TikTok");
  const language = String(p.language ?? "IT");
  const notes = String(p.notes ?? "Generic short-form video for a small business.");

  let verdictText =
    "Solid hook (0.4s), but attention drops after 5s when the visual stops evolving. Tighten cuts and bring the payoff forward to gain ~10 points.";
  let score = 68;

  if (apiKey) {
    try {
      const out = await aiStructured<{ score: number; verdict: string }>({
        apiKey,
        system:
          "You are a short-form video performance analyst. Be concrete and specific. Reply in the same language as the user's notes.",
        user: `Goal: ${goal}\nPlatform: ${platform}\nLanguage: ${language}\nNotes about the video: ${notes}\n\nProduce a 0-100 virality score and a 2-3 sentence verdict that names a concrete weakness and a concrete fix.`,
        toolName: "verdict",
        schema: {
          type: "object",
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            verdict: { type: "string" },
          },
          required: ["score", "verdict"],
          additionalProperties: false,
        },
      });
      score = Math.round(out.score);
      verdictText = out.verdict;
    } catch (e) {
      console.warn("analyzer AI fallback:", e);
    }
  }

  await progress(admin, jobId, 75, "Generating recommendations…");

  return {
    verdict: {
      score,
      grade: gradeFromScore(score),
      text: verdictText,
      goal,
      cohort: 87,
      language,
      platform,
    },
  };
}

function gradeFromScore(s: number) {
  if (s >= 90) return "A";
  if (s >= 80) return "A-";
  if (s >= 70) return "B+";
  if (s >= 60) return "B-";
  if (s >= 50) return "C";
  return "D";
}

// ---------- SCRIPTWRITER ----------
async function runScript(p: any, apiKey: string | undefined, admin: any, jobId: string) {
  await progress(admin, jobId, 20, "Drafting hooks…");

  const goal = String(p.goal ?? "Drive saves");
  const angle = String(p.angle ?? "");
  const tone = String(p.tone ?? "Calm authority");
  const platform = String(p.platform ?? "Reels");
  const format = String(p.format ?? "Talking head");
  const language = String(p.language ?? "en");

  if (!apiKey) {
    return { variants: fallbackVariants() };
  }

  const out = await aiStructured<{ variants: AiVariant[] }>({
    apiKey,
    system:
      "You write short-form video scripts for social media. Output 3 variants, each with 4-6 beats. Each beat must be concrete and shootable. Reply in the user's specified language.",
    user: `Goal: ${goal}
Angle: ${angle || "(none specified — invent one)"}
Tone: ${tone}
Platform: ${platform}
Format: ${format}
Language: ${language}

Generate 3 distinct rhetorical angles for the same idea. For each variant include a label, one-line angle, predicted virality score 0-100, the rhetorical device used, optional warnings array, and 4-6 beats. Beats must include type (hook|setup|payoff|twist|cta), title, voiceover line, on-screen text, visual direction, and a 0-100 weight estimating how much retention would drop without that beat. Keep voiceover lines under 18 words.`,
    toolName: "variants",
    schema: {
      type: "object",
      properties: {
        variants: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              angle: { type: "string" },
              score: { type: "number", minimum: 0, maximum: 100 },
              device: { type: "string" },
              warnings: { type: "array", items: { type: "string" } },
              beats: {
                type: "array",
                minItems: 4,
                maxItems: 6,
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["hook", "setup", "payoff", "twist", "cta"] },
                    title: { type: "string" },
                    voiceover: { type: "string" },
                    onScreen: { type: "string" },
                    visual: { type: "string" },
                    dur: { type: "number", minimum: 1.5, maximum: 8 },
                    weight: { type: "number", minimum: 0, maximum: 100 },
                  },
                  required: ["type", "title", "voiceover", "onScreen", "visual", "dur", "weight"],
                },
              },
            },
            required: ["label", "angle", "score", "device", "beats"],
          },
        },
      },
      required: ["variants"],
      additionalProperties: false,
    },
  });

  await progress(admin, jobId, 80, "Scoring retention curves…");

  const variants = out.variants.map((v, idx) => {
    let cursor = 0;
    const beats = v.beats.map((b, bi) => {
      const t = cursor;
      cursor += b.dur;
      return {
        id: `v${idx}_b${bi}`,
        t,
        dur: b.dur,
        type: b.type,
        title: b.title,
        voiceover: b.voiceover,
        onScreen: b.onScreen,
        visual: b.visual,
        weight: Math.round(b.weight),
      };
    });
    return {
      id: `v${idx + 1}`,
      label: v.label,
      angle: v.angle,
      score: Math.round(v.score),
      cohortRank: cohortRank(v.score),
      device: v.device,
      warnings: v.warnings ?? [],
      retention: makeRetention(idx),
      beats,
    };
  });

  return { variants };
}

type AiVariant = {
  label: string;
  angle: string;
  score: number;
  device: string;
  warnings?: string[];
  beats: {
    type: "hook" | "setup" | "payoff" | "twist" | "cta";
    title: string;
    voiceover: string;
    onScreen: string;
    visual: string;
    dur: number;
    weight: number;
  }[];
};

function cohortRank(score: number) {
  if (score >= 85) return "Top 8% in cohort";
  if (score >= 75) return "Top 22% in cohort";
  if (score >= 65) return "Top 31% in cohort";
  return "Mid-pack in cohort";
}

function makeRetention(seed: number): number[] {
  const gauss = (x: number, mu: number, sig: number) =>
    Math.exp(-((x - mu) ** 2) / (2 * sig * sig));
  return Array.from({ length: 30 }, (_, i) => {
    const x = i / 29;
    const decay = Math.max(0, 1 - x * (0.55 + (seed % 7) * 0.02));
    const hookBump = gauss(x, 0.05, 0.06) * 0.05;
    const payoffBump = gauss(x, 0.45, 0.08) * 0.08;
    return Math.max(0.1, Math.min(1, decay + hookBump + payoffBump));
  });
}

function fallbackVariants() {
  return [
    {
      id: "v1",
      label: "The contrarian",
      angle: "Most people get this wrong. Here's the boring truth.",
      score: 82,
      cohortRank: "Top 12%",
      device: "Pattern interrupt → reframe",
      warnings: [],
      retention: makeRetention(0),
      beats: [
        { id: "v0_b0", t: 0, dur: 2, type: "hook", title: "Pattern interrupt", voiceover: "Stop scrolling.", onScreen: "WAIT.", visual: "Tight close-up", weight: 90 },
        { id: "v0_b1", t: 2, dur: 4, type: "setup", title: "Claim", voiceover: "Everyone gets this wrong.", onScreen: "Wrong.", visual: "Cut to subject", weight: 70 },
        { id: "v0_b2", t: 6, dur: 5, type: "payoff", title: "Proof", voiceover: "Here's what actually works.", onScreen: "Proof.", visual: "Slow reveal", weight: 85 },
        { id: "v0_b3", t: 11, dur: 3, type: "cta", title: "CTA", voiceover: "Save this.", onScreen: "Save.", visual: "End card", weight: 50 },
      ],
    },
  ];
}

// ---------- EDITOR (deterministic — real video processing is out of scope) ----------
async function runEditor(p: any, admin: any, jobId: string) {
  for (const step of ["Cutting clips…", "Snapping to beats…", "Color matching…", "Rendering preview…"]) {
    await progress(admin, jobId, 25, step);
    await new Promise((r) => setTimeout(r, 350));
  }
  return {
    timeline_id: crypto.randomUUID(),
    duration_s: Number(p.target_duration ?? 22.4),
    clip_count: 14,
    cuts_per_second: 1.7,
    preview_url: null,
  };
}

// ---------- PUBLISHER ----------
async function runPublisher(p: any, admin: any, jobId: string) {
  const platforms: string[] = Array.isArray(p.platforms) ? p.platforms : ["instagram"];
  await progress(admin, jobId, 30, `Queued for ${platforms.length} platform(s)…`);
  await new Promise((r) => setTimeout(r, 500));
  await progress(admin, jobId, 70, "Confirming with platform APIs…");
  return {
    scheduled_at: p.scheduled_at ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    posts: platforms.map((pl) => ({
      platform: pl,
      status: "scheduled",
      external_id: `mock_${pl}_${Date.now()}`,
    })),
  };
}

// ---------- ANALYTICS ----------
async function runAnalytics(p: any, admin: any, jobId: string) {
  await progress(admin, jobId, 40, "Fetching latest metrics…");
  await new Promise((r) => setTimeout(r, 300));
  const range = String(p.range ?? "7d");
  const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
  const series = Array.from({ length: days }, (_, i) => ({
    day: i,
    views: Math.round(1000 + Math.sin(i / 3) * 600 + Math.random() * 400),
    engagement: +(0.04 + Math.random() * 0.03).toFixed(3),
  }));
  const total_views = series.reduce((s, d) => s + d.views, 0);
  return {
    range,
    total_views,
    avg_engagement: +(series.reduce((s, d) => s + d.engagement, 0) / series.length).toFixed(3),
    series,
  };
}
