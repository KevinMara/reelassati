export default function handler(req: any, res: any) {
  try {
    return res.status(200).json({
      ok: true,
      framework: "vite",
      runtime: "vercel-serverless",
      routes: {
        health: "/api/health",
        dbCheck: "/api/admin/db-check",
        adminStatus: "/api/admin/status",
        jobs: "/api/jobs/[id]"
      }
    })
  } catch (error) {
    return res.status(200).json({
      ok: false,
      error: "route_test_failed"
    })
  }
}
