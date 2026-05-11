import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { serviceClient } from '../_shared/auth.ts'
import { logApiUsage } from '../_shared/budget.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  
  // Auth: only Hermes can call this (service token)
  const authHeader = req.headers.get('Authorization')
  // Note: The instruction said Deno.env.get('SUPABASE_SERVICE_KEY'), 
  // but usually it's checked against a custom HERMES_SERVICE_TOKEN or the SERVICE_ROLE_KEY.
  // The user prompt specifically said "verify service token (only Hermes calls it)" 
  // and provided HERMES_SERVICE_TOKEN as a secret.
  const HERMES_SERVICE_TOKEN = Deno.env.get('HERMES_SERVICE_TOKEN')
  
  if (authHeader !== `Bearer ${HERMES_SERVICE_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  try {
    const payload = await req.json()
    const supabase = serviceClient()
    
    // Two types of callbacks: job-related and chat-related
    if (payload.job_id) {
      // Job progress/result callback
      return await handleJobCallback(supabase, payload)
    } else if (payload.session_id) {
      // Chat callback
      return await handleChatCallback(supabase, payload)
    } else {
      return new Response('Invalid callback payload', { status: 400 })
    }
    
  } catch (e) {
    console.error('Callback error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

async function handleJobCallback(supabase: any, payload: any) {
  const { job_id, event, status, progress_pct, message, result, error_details, cost_eur, cost_breakdown } = payload

  // Build update
  const update: any = {}
  if (status) update.status = status
  if (typeof progress_pct === 'number') update.progress_pct = progress_pct
  if (message) update.progress_message = message
  if (event === 'complete') {
    update.status = 'complete'
    update.result = result
    update.actual_cost_eur = cost_eur || 0
    update.completed_at = new Date().toISOString()
  }
  if (event === 'failed') {
    update.status = 'failed'
    update.error_details = error_details
    update.completed_at = new Date().toISOString()
  }
  
  // Update jobs table — triggers Realtime push to UI
  await supabase.from('jobs').update(update).eq('id', job_id)
  
  // Log activity
  if (event === 'complete' || event === 'failed') {
    const { data: job } = await supabase
      .from('jobs')
      .select('user_id, client_id, agent_name, job_type')
      .eq('id', job_id)
      .single()
    
    if (job) {
      await supabase.from('activity_log').insert({
        user_id: job.user_id,
        client_id: job.client_id,
        agent_name: job.agent_name,
        action_type: job.job_type,
        description: event === 'complete' ? `${job.agent_name} completed ${job.job_type}` : `${job.agent_name} failed ${job.job_type}`,
        related_entity_type: 'job',
        related_entity_id: job_id,
        metadata: { event, cost_eur }
      })
      
      // Log API usage and deduct from budget
      if (cost_breakdown) {
        for (const [service, cost] of Object.entries(cost_breakdown)) {
          await logApiUsage(
            job.user_id,
            job.agent_name,
            job.job_type,
            service,
            cost as number,
            { job_id }
          )
        }
      } else if (cost_eur) {
        await logApiUsage(
          job.user_id,
          job.agent_name,
          job.job_type,
          'aggregate',
          cost_eur,
          { job_id }
        )
      }
    }
  }
  
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleChatCallback(supabase: any, payload: any) {
  const { session_id, event, content, final_message, user_id } = payload
  
  // Insert chat message
  await supabase.from('chat_messages').insert({
    session_id,
    user_id,
    role: 'agent',
    content: content || final_message,
    is_streaming_chunk: event === 'chunk',
    is_final: event === 'complete'
  })
  
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
