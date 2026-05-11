import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getAuthenticatedUser, serviceClient } from '../_shared/auth.ts'
import { checkBudget } from '../_shared/budget.ts'
import { invokeChat, callbackUrl } from '../_shared/hermes.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  
  try {
    const user = await getAuthenticatedUser(req.headers.get('Authorization'))
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { agent, session_id, message, context, client_id } = await req.json()
    
    const estimatedCost = 0.05
    const budgetCheck = await checkBudget(user.id, estimatedCost)
    if (!budgetCheck.allowed) {
      return new Response(JSON.stringify({ error: 'budget_exceeded', details: budgetCheck }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const supabase = serviceClient()
    
    // Insert user message locally
    await supabase.from('chat_messages').insert({
      session_id,
      user_id: user.id,
      agent_name: agent,
      role: 'user',
      content: message,
      metadata: context
    })
    
    try {
      await invokeChat({
        agent: `${agent}_agent`,
        session_id,
        user_id: user.id,
        client_id: client_id || null,
        message,
        context,
        callback_url: callbackUrl()
      })
    } catch (hermesError) {
      // Notify user of connection issue
      await supabase.from('chat_messages').insert({
        session_id,
        user_id: user.id,
        agent_name: agent,
        role: 'agent',
        content: "I'm having trouble connecting to my brain. Please try again in a moment.",
        is_final: true
      })
      
      return new Response(JSON.stringify({ error: 'agent_unreachable' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
