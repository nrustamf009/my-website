export const ACCEPTED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"] as const;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export interface TranscriptionInput {
  filePath: string;
  filename: string;
  mimeType: string;
}

export interface Transcriber {
  readonly mode: "whisper" | "mock";
  transcribe(input: TranscriptionInput): Promise<{ text: string; durationSec?: number }>;
}
