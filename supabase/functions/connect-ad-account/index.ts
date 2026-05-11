import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  
  try {
    const user = await getAuthenticatedUser(req.headers.get('Authorization'))
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { platform, client_id } = await req.json()
    
    // Unified.to OAuth initiation logic
    const HERMES_ENDPOINT = Deno.env.get('HERMES_ENDPOINT')
    const HERMES_SERVICE_TOKEN = Deno.env.get('HERMES_SERVICE_TOKEN')
    
    const response = await fetch(`${HERMES_ENDPOINT}/auth/unified/initiate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HERMES_SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: user.id,
        client_id,
        platform
      })
    })
    
    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
