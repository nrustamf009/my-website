import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { del } from "@vercel/blob";
import { env } from "@/lib/env";

/**
 * Temporary audio storage. Files only live long enough to be transcribed, then are deleted.
 * Locally (and for small files) audio arrives in the request body; on Vercel larger files go
 * to Vercel Blob via client upload and are deleted right after processing.
 */
export async function withTempAudio<T>(data: Buffer, filename: string, fn: (filePath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dscr-call-"));
  const safeName = filename.replace(/[^a-z0-9.]+/gi, "_").slice(-60) || "call.mp3";
  const filePath = path.join(dir, safeName);
  try {
    await writeFile(filePath, data);
    return await fn(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function fetchAndDeleteBlob(url: string): Promise<Buffer> {
  if (!env.blobToken) throw new Error("Blob storage is not configured");
  if (!/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i.test(url)) throw new Error("Invalid blob URL");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Blob fetch failed: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    await del(url, { token: env.blobToken }).catch(() => {});
  }
}
