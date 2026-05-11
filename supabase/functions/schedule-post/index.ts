import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getAuthenticatedUser, serviceClient } from "../_shared/auth.ts"
import { checkBudget, logApiUsage } from "../_shared/budget.ts"
import { invokeAgent, callbackUrl } from "../_shared/hermes.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const user = await getAuthenticatedUser(req.headers.get('Authorization'))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    
    const body = await req.json()
    const { video_id, platforms, captions, scheduled_at, client_id } = body
    
    const COST = 0.25 * platforms.length
    const budget = await checkBudget(user.id, COST)
    if (!budget.allowed) return new Response(JSON.stringify({ error: 'budget_exceeded', ...budget }), { status: 402, headers: corsHeaders })
    
    const supabase = serviceClient()
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        client_id: client_id || null,
        agent_name: 'publisher',
        job_type: 'schedule_post',
        payload: { video_id, platforms, captions, scheduled_at },
        status: 'queued'
      })
      .select()
      .single()
      
    if (jobError) throw jobError
    
    await invokeAgent({
      agent: 'publisher_agent',
      job_id: job.id,
      user_id: user.id,
      client_id: client_id || null,
      input: { video_id, platforms, captions, scheduled_at },
      callback_url: callbackUrl()
    })
    
    await logApiUsage(user.id, 'publisher', 'invoke', 'hermes', COST, { job_id: job.id })
    
    return new Response(JSON.stringify({ job_id: job.id }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
