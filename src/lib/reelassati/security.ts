/**
 * Helpers for internal and TRIBE callback authentication.
 * Works with both standard Node.js (Vercel) and web standard Request objects.
 */

export function verifyTribeAuth(req: any): boolean {
  const authHeader = req.headers?.authorization || (req instanceof Request ? req.headers.get("authorization") : null);
  return authHeader === `Bearer ${process.env.TRIBE_API_KEY}`;
}

export function verifyInternalAuth(req: any): boolean {
  const authHeader = req.headers?.authorization || (req instanceof Request ? req.headers.get("authorization") : null);
  return authHeader === `Bearer ${process.env.INTERNAL_AGENT_SECRET}`;
}

export function getInternalAuthHeaders() {
  return {
    "Authorization": `Bearer ${process.env.INTERNAL_AGENT_SECRET}`,
    "Content-Type": "application/json"
  };
}
