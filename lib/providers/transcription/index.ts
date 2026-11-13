/**
 * Transcription is intentionally OFF in v1: we never accept or store audio.
 * The interface exists so a self-serve provider can be added later behind TRANSCRIPTION_ENABLED=true.
 */
export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audio: Blob): Promise<string>;
}

export function transcriptionEnabled(): boolean {
  return process.env.TRANSCRIPTION_ENABLED === "true" && !!process.env.TRANSCRIBE_API_KEY;
}

export function getTranscriptionProvider(): TranscriptionProvider | null {
  if (!transcriptionEnabled()) return null;
  return {
    name: "stub",
    async transcribe() {
      throw new Error("Transcription is not implemented in this version. Paste notes or a transcript instead.");
    },
  };
}
