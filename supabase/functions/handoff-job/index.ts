import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getAuthenticatedUser, serviceClient } from "../_shared/auth.ts"
import { invokeHandoff, callbackUrl } from "../_shared/hermes.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const user = await getAuthenticatedUser(req.headers.get('Authorization'))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    
    const body = await req.json()
    const { from_agent, to_agent, handoff_type, payload } = body
    
    const supabase = serviceClient()
    
    // Create handoff job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        agent_name: to_agent,
        job_type: `handoff_${handoff_type}`,
        payload,
        status: 'queued'
      })
      .select()
      .single()
      
    if (jobError) throw jobError
    
    await invokeHandoff({
      from_agent,
      to_agent,
      handoff_type,
      payload,
      callback_url: callbackUrl()
    })
    
    return new Response(JSON.stringify({ job_id: job.id }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
