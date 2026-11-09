import { NextResponse } from "next/server";
import { requireBroker } from "@/lib/auth/session";
import { processCall, CALL_ERRORS } from "@/lib/calls/process";
import { fetchAndDeleteBlob } from "@/lib/providers/storage";

export const maxDuration = 300;

const OK_TYPES = /^audio\/(mpeg|mp3|mp4|x-m4a|m4a|aac)$/;

/** Accepts either multipart audio (local / small files) or JSON {blobUrl} after a Vercel Blob client upload. */
export async function POST(req: Request) {
  const { broker } = await requireBroker();
  const type = req.headers.get("content-type") ?? "";
  let audio: { data: Buffer; filename: string; mimeType: string };
  if (type.includes("application/json")) {
    const { blobUrl, filename, mimeType } = (await req.json()) as { blobUrl: string; filename: string; mimeType: string };
    if (!OK_TYPES.test(mimeType) && !/\.(mp3|m4a)$/i.test(filename)) return NextResponse.json({ error: CALL_ERRORS.BAD_TYPE }, { status: 400 });
    audio = { data: await fetchAndDeleteBlob(blobUrl), filename, mimeType };
  } else {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (!OK_TYPES.test(file.type) && !/\.(mp3|m4a)$/i.test(file.name)) return NextResponse.json({ error: CALL_ERRORS.BAD_TYPE }, { status: 400 });
    audio = { data: Buffer.from(await file.arrayBuffer()), filename: file.name, mimeType: file.type || "audio/mpeg" };
  }
  const result = await processCall({ brokerId: broker.id, audio });
  return result.ok ? NextResponse.json({ id: result.id }) : NextResponse.json({ error: CALL_ERRORS[result.code] }, { status: 422 });
}
