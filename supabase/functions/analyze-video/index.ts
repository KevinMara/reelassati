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
    
    const { video_url, client_id, goal, audience, platform, language } = await req.json()
    
    // Required field validation
    if (!video_url) {
      return new Response(JSON.stringify({ error: 'video_url required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Budget check
    const estimatedCost = 0.50
    const budgetCheck = await checkBudget(user.id, estimatedCost)
    if (!budgetCheck.allowed) {
      return new Response(JSON.stringify({
        error: 'budget_exceeded',
        details: budgetCheck
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Create job record
    const supabase = serviceClient()
    const { data: job, error } = await supabase.from('jobs').insert({
      user_id: user.id,
      client_id,
      agent_name: 'video_analyzer',
      job_type: 'analyze_video',
      status: 'queued',
      payload: { video_url, goal, audience, platform, language },
      estimated_cost_eur: estimatedCost
    }).select().single()
    
    if (error) throw error
    
    // Fire-and-forget to Hermes
    try {
      await invokeAgent({
        agent: 'video_analyzer',
        job_id: job.id,
        user_id: user.id,
        client_id: client_id || null,
        input: { video_url, goal, audience, platform, language: language || 'it' },
        callback_url: callbackUrl()
      })
    } catch (hermesError) {
      // Mark job as failed if Hermes is unreachable
      await supabase.from('jobs').update({
        status: 'failed',
        error_details: { stage: 'hermes_invoke', error: String(hermesError) }
      }).eq('id', job.id)
      
      return new Response(JSON.stringify({ error: 'agent_unreachable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ job_id: job.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
