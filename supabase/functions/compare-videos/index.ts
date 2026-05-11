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
    
    const { video_urls, client_id, criterion } = await req.json()
    
    if (!video_urls || !Array.isArray(video_urls) || video_urls.length < 2) {
      return new Response(JSON.stringify({ error: 'At least 2 video_urls required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const estimatedCost = 1.00
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
      agent_name: 'video_analyzer',
      job_type: 'compare_videos',
      status: 'queued',
      payload: { video_urls, criterion },
      estimated_cost_eur: estimatedCost
    }).select().single()
    
    if (error) throw error
    
    try {
      await invokeAgent({
        agent: 'video_comparator',
        job_id: job.id,
        user_id: user.id,
        client_id: client_id || null,
        input: { video_urls, criterion },
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
