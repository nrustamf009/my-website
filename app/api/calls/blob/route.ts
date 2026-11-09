import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireBroker } from "@/lib/auth/session";
import { env } from "@/lib/env";

/** Issues short-lived client-upload tokens for call recordings (Vercel only). */
export async function POST(req: Request) {
  await requireBroker();
  if (!env.blobToken) return NextResponse.json({ error: "Blob not configured" }, { status: 400 });
  const body = (await req.json()) as HandleUploadBody;
  const json = await handleUpload({
    body,
    request: req,
    token: env.blobToken,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"],
      maximumSizeInBytes: 25 * 1024 * 1024,
      addRandomSuffix: true,
    }),
    onUploadCompleted: async () => {},
  });
  return NextResponse.json(json);
}
