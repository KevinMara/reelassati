// Thumbnail generation: 3-stage pipeline
// 1) "TRIBE v2" concept (engagement-driven concept directions) — Lovable AI text model
// 2) "Opus 4.7" prompt synthesis — Lovable AI text model with structured output
// 3) "GPT Image 2" image generation — Lovable AI image model (gemini-2.5-flash-image)
//    NOTE: We use Lovable AI's image model so this works out of the box without an extra
//    OpenAI API key. The prompt format is GPT-Image-style and is portable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-3-flash-preview";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

const COST_PER_IMAGE = { medium: 0.05, high: 0.20 } as const;
const TEXT_COST = 0.01;

type Body = {
  draft_id?: string;
  platform: string;
  title: string;
  quality?: "medium" | "high";
  refinement_of?: string;
  refinement_instruction?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.slice(7));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body?.platform || !body?.title) return json({ error: "platform and title required" }, 400);
    const quality = body.quality === "high" ? "high" : "medium";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Budget check
    const { data: profile } = await admin
      .from("profiles")
      .select("monthly_api_budget_eur, api_spend_this_cycle_eur, is_unlimited")
      .eq("id", userId)
      .maybeSingle();
    const estimated = COST_PER_IMAGE[quality] * 3 + TEXT_COST * 2;
    if (profile && !profile.is_unlimited) {
      const remaining = Number(profile.monthly_api_budget_eur) - Number(profile.api_spend_this_cycle_eur);
      if (remaining < estimated) {
        return json({
          error: "budget_exceeded",
          message: `Need €${estimated.toFixed(2)}, only €${remaining.toFixed(2)} left this cycle.`,
        }, 402);
      }
    }

    // Try to reuse cached Stage-1 if refinement
    let tribev2: any = null;
    if (body.refinement_of) {
      const { data: parent } = await admin
        .from("thumbnail_generations")
        .select("tribev2_concept")
        .eq("id", body.refinement_of)
        .maybeSingle();
      tribev2 = parent?.tribev2_concept ?? null;
    }

    // Create generation row
    const { data: gen, error: insErr } = await admin
      .from("thumbnail_generations")
      .insert({
        draft_id: body.draft_id ?? null,
        user_id: userId,
        parent_generation_id: body.refinement_of ?? null,
        refinement_instruction: body.refinement_instruction ?? null,
        platform: body.platform,
        title: body.title,
        quality,
        status: "pending",
      })
      .select()
      .single();
    if (insErr || !gen) return json({ error: insErr?.message ?? "insert failed" }, 500);

    // Stage 1
    if (!tribev2) {
      tribev2 = await stage1Concept(LOVABLE_API_KEY, body.title, body.platform);
      await admin.from("thumbnail_generations").update({ tribev2_concept: tribev2 }).eq("id", gen.id);
    }

    // Stage 2
    const opusPrompts = await stage2Prompts(
      LOVABLE_API_KEY,
      tribev2,
      body.title,
      body.platform,
      body.refinement_instruction,
    );
    await admin.from("thumbnail_generations").update({ opus_prompts: opusPrompts }).eq("id", gen.id);

    // Stage 3 — generate 3 images in parallel
    const results = await Promise.all(
      opusPrompts.candidates.map((c: any, i: number) =>
        stage3Image(LOVABLE_API_KEY, c.image_prompt, userId, gen.id, i, admin),
      ),
    );

    const candidates = opusPrompts.candidates.map((c: any, i: number) => ({
      index: i,
      storage_key: results[i].storage_key,
      image_url: results[i].signed_url,
      concept: c.concept,
      uses_text_overlay: c.uses_text_overlay ?? false,
      text_overlay_content: c.text_overlay_content ?? null,
      engagement_signals: c.predicted_engagement_signals ?? [],
      predicted_engagement_score: c.primary_concept_match_score ?? 0.8,
    }));

    const totalCost = COST_PER_IMAGE[quality] * 3 + TEXT_COST * 2;

    await admin
      .from("thumbnail_generations")
      .update({
        generated_image_keys: results.map((r) => r.storage_key),
        candidates,
        total_cost_eur: totalCost,
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", gen.id);

    if (body.draft_id) {
      await admin
        .from("drafts")
        .update({ thumbnail_candidates: candidates, thumbnail_source: "ai_generated" })
        .eq("id", body.draft_id);
    }

    return json({
      generation_id: gen.id,
      candidates,
      total_cost_eur: totalCost,
    });
  } catch (e) {
    console.error("generate-thumbnail error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

async function stage1Concept(apiKey: string, title: string, platform: string) {
  const sys = "You are TRIBE v2, a neural engagement model. You identify concept directions that maximize visual cortex (V1/V2), face fusiform area (FFA) and limbic engagement on a thumbnail.";
  const user = `Title: "${title}"\nPlatform: ${platform}\nReturn 3 concept directions optimized for high-attention thumbnail design (face-forward, curiosity, motion-freeze, etc).`;
  const res = await callAI(apiKey, TEXT_MODEL, [
    { role: "system", content: sys },
    { role: "user", content: user },
  ], {
    type: "function",
    function: {
      name: "emit_concept",
      parameters: {
        type: "object",
        properties: {
          high_attention_frames: { type: "array", items: { type: "object" } },
          recommended_concept_directions: { type: "array", items: { type: "string" } },
          engagement_score_target: { type: "number" },
        },
        required: ["recommended_concept_directions", "engagement_score_target"],
      },
    },
  });
  return res ?? {
    high_attention_frames: [],
    recommended_concept_directions: ["face-forward emotional capture", "object-of-curiosity center frame", "dynamic motion freeze"],
    engagement_score_target: 0.85,
  };
}

async function stage2Prompts(
  apiKey: string,
  tribev2: any,
  title: string,
  platform: string,
  refinement?: string,
) {
  const sys = "You are Opus 4.7, an expert thumbnail art director. Translate engagement concepts into precise GPT-Image-style prompts. Vertical 9:16. Photorealistic. Include text overlay specs when appropriate.";
  const user = `Title: "${title}"
Platform: ${platform}
Concept directions: ${JSON.stringify(tribev2.recommended_concept_directions)}
${refinement ? `Refinement instruction: ${refinement}` : ""}
Generate 3 distinct image prompts.`;
  const res = await callAI(apiKey, TEXT_MODEL, [
    { role: "system", content: sys },
    { role: "user", content: user },
  ], {
    type: "function",
    function: {
      name: "emit_prompts",
      parameters: {
        type: "object",
        properties: {
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                concept: { type: "string" },
                image_prompt: { type: "string" },
                predicted_engagement_signals: { type: "array", items: { type: "string" } },
                uses_text_overlay: { type: "boolean" },
                text_overlay_content: { type: "string" },
                primary_concept_match_score: { type: "number" },
              },
              required: ["concept", "image_prompt"],
            },
          },
        },
        required: ["candidates"],
      },
    },
  });
  return res ?? { candidates: [] };
}

async function stage3Image(
  apiKey: string,
  prompt: string,
  userId: string,
  genId: string,
  index: number,
  admin: ReturnType<typeof createClient>,
) {
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: `${prompt}\n\nVertical 9:16 aspect ratio.` }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) throw new Error(`image gen ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const url: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url?.startsWith("data:")) throw new Error("no image data returned");

  const [meta, b64] = url.split(",");
  const contentType = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const path = `${userId}/${genId}/${index}.png`;
  const up = await admin.storage.from("thumbnails").upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (up.error) throw up.error;

  const { data: signed } = await admin.storage.from("thumbnails").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { storage_key: path, signed_url: signed?.signedUrl ?? "" };
}

async function callAI(apiKey: string, model: string, messages: any[], tool: any) {
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
