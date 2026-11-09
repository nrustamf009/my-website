import { readFile } from "node:fs/promises";
import type { Transcriber, TranscriptionInput } from "./types";

/**
 * Any OpenAI-compatible /audio/transcriptions endpoint (OpenAI Whisper, Groq, etc.).
 * Configure with TRANSCRIBE_BASE_URL, TRANSCRIBE_MODEL, TRANSCRIBE_API_KEY.
 */
export class WhisperTranscriber implements Transcriber {
  readonly mode = "whisper" as const;
  constructor(private apiKey: string, private baseUrl: string, private model: string) {}

  async transcribe(input: TranscriptionInput) {
    const bytes = await readFile(input.filePath);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: input.mimeType }), input.filename);
    form.append("model", this.model);
    form.append("response_format", "json");
    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(280_000),
    });
    if (!res.ok) throw new Error(`Transcription failed with HTTP ${res.status}`);
    const data = (await res.json()) as { text?: string; duration?: number };
    return { text: (data.text ?? "").trim(), durationSec: data.duration };
  }
}
