const HERMES_ENDPOINT = Deno.env.get('HERMES_ENDPOINT')!
const HERMES_SERVICE_TOKEN = Deno.env.get('HERMES_SERVICE_TOKEN')!

export async function invokeAgent(params: {
  agent: string
  job_id: string
  user_id: string
  client_id: string | null
  input: any
  callback_url: string
}) {
  const response = await fetch(`${HERMES_ENDPOINT}/agent/invoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HERMES_SERVICE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  })
  
  if (!response.ok) {
    throw new Error(`Hermes returned ${response.status}: ${await response.text()}`)
  }
  
  return response.json()
}

export async function invokeChat(params: {
  agent: string
  session_id: string
  user_id: string
  client_id: string | null
  message: string
  context: any
  callback_url: string
}) {
  const response = await fetch(`${HERMES_ENDPOINT}/agent/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HERMES_SERVICE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  })
  
  return response.json()
}

export async function invokeHandoff(params: {
  from_agent: string
  to_agent: string
  handoff_type: string
  payload: any
  callback_url: string
}) {
  const response = await fetch(`${HERMES_ENDPOINT}/agent/handoff`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HERMES_SERVICE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  })
  
  return response.json()
}

export function callbackUrl() {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-callback`
}
