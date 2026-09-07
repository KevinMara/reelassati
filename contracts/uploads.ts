export const MAX_AI_MEDIA_BYTES = 24 * 1024 * 1024;

export const AI_MEDIA_SIZE_LABEL = "24 MB";

// Small files use a single request. Larger media is split into resumable R2
// multipart uploads, so the product does not impose an arbitrary file-size cap.
export const DIRECT_UPLOAD_MAX_BYTES = 32 * 1024 * 1024;
export const UPLOAD_PART_BYTES = 16 * 1024 * 1024;
