import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getAuthenticatedUser, serviceClient } from '../_shared/auth.ts'
import { checkBudget } from '../_shared/budget.ts'
import { invokeAgent, callbackUrl } from '../_shared/hermes.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  
  try {
    const user = await getAuthenticatedUser(req.headers.get('Authorization'))
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { script_id, footage_keys, client_id, music_id, style_id } = await req.json()
    
    const estimatedCost = 1.50
    const budgetCheck = await checkBudget(user.id, estimatedCost)
    if (!budgetCheck.allowed) {
      return new Response(JSON.stringify({ error: 'budget_exceeded', details: budgetCheck }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const supabase = serviceClient()
    const { data: job, error } = await supabase.from('jobs').insert({
      user_id: user.id,
      client_id,
      agent_name: 'video_editor',
      job_type: 'start_edit',
      status: 'queued',
      payload: { script_id, footage_keys, music_id, style_id },
      estimated_cost_eur: estimatedCost
    }).select().single()
    
    if (error) throw error
    
    try {
      await invokeAgent({
        agent: 'video_editor',
        job_id: job.id,
        user_id: user.id,
        client_id: client_id || null,
        input: { script_id, footage_keys, music_id, style_id },
        callback_url: callbackUrl()
      })
    } catch (hermesError) {
      await supabase.from('jobs').update({
        status: 'failed',
        error_details: { stage: 'hermes_invoke', error: String(hermesError) }
      }).eq('id', job.id)
      
      return new Response(JSON.stringify({ error: 'agent_unreachable' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ job_id: job.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
