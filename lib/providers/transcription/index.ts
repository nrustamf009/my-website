import { env } from "@/lib/env";
import { MockTranscriber } from "./mock";
import { WhisperTranscriber } from "./whisper";
import type { Transcriber } from "./types";

export * from "./types";

export function getTranscriber(): Transcriber {
  return env.transcribeKey ? new WhisperTranscriber(env.transcribeKey, env.transcribeBaseUrl, env.transcribeModel) : new MockTranscriber();
}
