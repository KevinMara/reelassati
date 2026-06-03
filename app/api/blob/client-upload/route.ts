import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return json(
        {
          ok: false,
          error: "blob_token_missing",
          message: "BLOB_READ_WRITE_TOKEN is not configured for this Vercel environment.",
        },
        500
      );
    }

    const body = (await request.json()) as HandleUploadBody;

    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-msvideo",
            "video/x-matroska",
            "application/octet-stream",
          ],
          maximumSizeInBytes: 1024 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            pathname,
            uploadedAt: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Blob upload completed", {
          url: blob.url,
          pathname: blob.pathname,
          tokenPayload,
        });
      },
    });

    return json(response);
  } catch (error: any) {
    console.error("Blob client upload error:", {
      message: error?.message,
      name: error?.name,
    });

    return json(
      {
        ok: false,
        error: "blob_client_upload_failed",
        message: error?.message || "Failed to create Vercel Blob upload token.",
      },
      500
    );
  }
}
