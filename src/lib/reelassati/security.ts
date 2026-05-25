export function verifyTribeAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization")
  return authHeader === `Bearer ${process.env.TRIBE_API_KEY}`
}

export function verifyInternalAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization")
  return authHeader === `Bearer ${process.env.INTERNAL_AGENT_SECRET}`
}

export function getInternalAuthHeaders() {
  return {
    "Authorization": `Bearer ${process.env.INTERNAL_AGENT_SECRET}`,
    "Content-Type": "application/json"
  }
}
