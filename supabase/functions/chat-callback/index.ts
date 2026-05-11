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
    const { session_id, user_id, content, is_final } = await req.json()
    const supabase = serviceClient()
    
    await supabase.from('chat_messages').insert({
        session_id,
        user_id,
        role: 'assistant',
        content,
        is_final: is_final ?? true
    })
    
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
