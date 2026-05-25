import { prisma } from '../../src/lib/prisma'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  try {
    const { external_id, status, results } = req.body

    if (!external_id) {
      return res.status(400).json({ ok: false, error: 'missing_external_id' })
    }

    // Update the tribe_run record
    const tribeRun = await prisma.tribeRun.updateMany({
      where: { externalId: external_id },
      data: {
        status: status === 'completed' ? 'completed' : 'failed',
        results: results || {}
      }
    })

    return res.status(200).json({ ok: true })
  } catch (error: any) {
    console.error('Tribe callback error:', error)
    return res.status(500).json({ 
      ok: false, 
      error: 'database_error' 
    })
  }
}
