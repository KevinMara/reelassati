import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { serviceClient } from "../_shared/auth.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  const HERMES_SERVICE_TOKEN = Deno.env.get('HERMES_SERVICE_TOKEN')
  const authHeader = req.headers.get('Authorization')
  
  if (authHeader !== `Bearer ${HERMES_SERVICE_TOKEN}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }
  
  try {
    const { job_id, status, progress_pct, progress_message, result, error_details } = await req.json()
    const supabase = serviceClient()
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }
    
    if (progress_pct !== undefined) updateData.progress_pct = progress_pct
    if (progress_message !== undefined) updateData.progress_message = progress_message
    if (result !== undefined) {
      updateData.result = result
      updateData.completed_at = new Date().toISOString()
    }
    if (error_details !== undefined) {
      updateData.error_details = error_details
      updateData.completed_at = new Date().toISOString()
    }
    
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', job_id)
      .select()
      .single()
      
    if (jobError) throw jobError
    
    // Log activity
    await supabase.from('activity_log').insert({
      user_id: job.user_id,
      client_id: job.client_id,
      agent_name: job.agent_name,
      action_type: `job_${status}`,
      description: `Job ${job.job_type} ${status}`,
      related_entity_type: 'job',
      related_entity_id: job.id,
      metadata: { job_type: job.job_type }
    })
    
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
