import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getAuthenticatedUser, serviceClient } from "../_shared/auth.ts"
import { checkBudget, logApiUsage } from "../_shared/budget.ts"
import { invokeChat, callbackUrl } from "../_shared/hermes.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const user = await getAuthenticatedUser(req.headers.get('Authorization'))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    
    const body = await req.json()
    const { agent, session_id, message, context, client_id } = body
    
    const COST = 0.05
    const budget = await checkBudget(user.id, COST)
    if (!budget.allowed) return new Response(JSON.stringify({ error: 'budget_exceeded', ...budget }), { status: 402, headers: corsHeaders })
    
    const supabase = serviceClient()
    
    // Log user message
    await supabase.from('chat_messages').insert({
        session_id,
        user_id: user.id,
        role: 'user',
        content: message
    })
    
    await invokeChat({
      agent: `${agent}_agent`,
      session_id,
      user_id: user.id,
      client_id: client_id || null,
      message,
      context,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/chat-callback`
    })
    
    await logApiUsage(user.id, agent, 'chat', 'hermes', COST, { session_id })
    
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
