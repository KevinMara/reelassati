import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export default async function handler(req: any, res: any) {
  const body = req.body as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Optional: add auth logic here
        return {
          allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
          tokenPayload: JSON.stringify({
            // optional payload
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This is called on the server after the upload is finished
        console.log('blob upload completed', blob, tokenPayload)
      },
    })

    return res.status(200).json(jsonResponse)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }
}
