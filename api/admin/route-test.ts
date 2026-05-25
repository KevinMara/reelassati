export default function handler(req: any, res: any) {
  return res.status(200).json({
    ok: true,
    routes: {
      health: "/api/health",
      dbCheck: "/api/admin/db-check",
      adminStatus: "/api/admin/status",
      jobs: "/api/jobs/[id]"
    }
  })
}
