export default async function handler(req: any, res: any) {
  res.status(200).json({
    ok: true,
    app: "reelassati",
    env: process.env.REELASSATI_APP_ENV || "unknown",
    database_ready: true
  })
}
