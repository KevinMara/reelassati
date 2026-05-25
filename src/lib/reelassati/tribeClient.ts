export interface TribeAnalysisRequest {
  video_url: string;
  callback_url: string;
  metadata?: any;
}

export interface TribeAnalysisResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'failed' | 'tribe_gpu_required';
  error_message?: string;
}

export async function callTribe(videoUrl: string, metadata: any = {}): Promise<TribeAnalysisResponse> {
  const tribeUrl = process.env.TRIBE_API_URL;
  const tribeKey = process.env.TRIBE_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  if (!tribeUrl || !tribeKey) {
    return {
      job_id: '',
      status: 'failed',
      error_message: 'TRIBE inference server is not configured yet.'
    };
  }

  try {
    const response = await fetch(`${tribeUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tribeKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_url: videoUrl,
        callback_url: `${appUrl}/api/webhooks/tribe-callback`,
        metadata
      })
    });

    if (response.status === 503 || response.status === 429) {
      const data = await response.json();
      if (data.error_code === 'TRIBE_GPU_REQUIRED') {
        return { job_id: '', status: 'tribe_gpu_required', error_message: 'TRIBE GPU required but unavailable.' };
      }
    }

    if (!response.ok) {
      return {
        job_id: '',
        status: 'failed',
        error_message: `TRIBE server responded with ${response.status}`
      };
    }

    return await response.json();
  } catch (error: any) {
    return {
      job_id: '',
      status: 'failed',
      error_message: error.message
    };
  }
}
