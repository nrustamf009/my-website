import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { withAiFallback } from "@/lib/providers/ai";
import { getTranscriber, MAX_AUDIO_BYTES } from "@/lib/providers/transcription";
import { withTempAudio } from "@/lib/providers/storage";

/** Transcribe (audio is deleted right after) and extract deal details. Logs never contain call content. */
export async function processCall(params: { brokerId: string; audio?: { data: Buffer; filename: string; mimeType: string }; notes?: string }) {
  let transcript = params.notes?.trim() ?? "";
  const inputType = params.audio ? "AUDIO" : "NOTES";
  try {
    if (params.audio) {
      if (params.audio.data.length > MAX_AUDIO_BYTES) throw new Error("FILE_TOO_LARGE");
      const audio = params.audio;
      const t = await withTempAudio(audio.data, audio.filename, (filePath) => getTranscriber().transcribe({ filePath, filename: audio.filename, mimeType: audio.mimeType }));
      transcript = t.text;
    }
    if (transcript.length < 40) throw new Error("TOO_SHORT");
    const { value: extraction, mode } = await withAiFallback("calls.extract", (ai) => ai.extractCall(transcript.slice(0, 60_000)));
    const title = [extraction.investor.name, extraction.deal.propertyAddress?.split(",")[0]].filter(Boolean).join(" · ") || "Untitled call";
    const call = await prisma.callSession.create({
      data: { brokerId: params.brokerId, inputType, status: "EXTRACTED", title, transcript, extraction: JSON.stringify(extraction) },
    });
    log.info("call.extracted", { callId: call.id, inputType, aiMode: mode, chars: transcript.length });
    return { ok: true as const, id: call.id };
  } catch (err) {
    const code = err instanceof Error && ["FILE_TOO_LARGE", "TOO_SHORT"].includes(err.message) ? err.message : "PROCESSING_FAILED";
    log.warn("call.failed", { code, inputType, error: err instanceof Error ? err.name : "unknown" });
    return { ok: false as const, code };
  }
}

export const CALL_ERRORS: Record<string, string> = {
  FILE_TOO_LARGE: "That recording is over 25 MB. Trim it or export at a lower bitrate.",
  TOO_SHORT: "There isn't enough text to work with. Paste more detail from the call.",
  PROCESSING_FAILED: "We couldn't process that call. Please try again.",
  BAD_TYPE: "Upload an MP3 or M4A file.",
};
