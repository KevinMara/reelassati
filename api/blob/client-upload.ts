import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const body = req.body as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (/* pathname */) => {
        // Optional: add auth logic here
        return {
          allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
          tokenPayload: JSON.stringify({
            // optional payload
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This is called on the server after the upload is finished
        console.log('Blob upload completed:', blob.url, tokenPayload)
      },
    })

    return res.status(200).json(jsonResponse)
  } catch (error) {
    console.error('Blob upload error:', error)
    return res.status(400).json({ 
      ok: false, 
      error: (error as Error).message 
    })
  }
}
