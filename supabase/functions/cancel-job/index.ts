import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getAuthenticatedUser, serviceClient } from "../_shared/auth.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const user = await getAuthenticatedUser(req.headers.get('Authorization'))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    
    const { job_id } = await req.json()
    const supabase = serviceClient()
    
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'failed', error_details: 'Cancelled by user' })
      .eq('id', job_id)
      .eq('user_id', user.id)
      .is('completed_at', null)
      
    if (error) throw error
    
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
