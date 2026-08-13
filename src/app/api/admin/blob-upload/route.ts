import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminSession } from "@/lib/admin-session";

export const runtime = "nodejs";

// Issues short-lived, scoped tokens so the browser can upload audio/poster files
// straight to Vercel Blob (bypassing the 4.5 MB serverless request-body limit).
// The admin session is verified before any token is granted.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!getAdminSession()) {
          throw new Error("unauthorized");
        }
        return {
          allowedContentTypes: ["audio/*", "image/*", "video/*"],
          addRandomSuffix: true,
          maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB per file
        };
      },
      // Required by the callback contract; nothing to persist here since the
      // browser sends the resulting URLs to /api/admin/songs itself.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "upload_failed" },
      { status: 400 }
    );
  }
}
