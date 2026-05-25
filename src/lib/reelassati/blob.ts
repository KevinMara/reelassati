import { list, del } from '@vercel/blob';

/**
 * Helpers for Vercel Blob operations within Reelassati.
 */

export async function deleteVideoBlob(url: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is missing');
    return;
  }
  await del(url);
}

export async function listRecentBlobs(limit = 10) {
  const { blobs } = await list({ limit });
  return blobs;
}
