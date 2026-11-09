"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { processNotes } from "@/lib/actions/calls";
import { SAMPLE_CALLS } from "@/lib/calls/samples";
import { Button, Card, Notice, Textarea, cx } from "@/components/ui";

const MAX_DIRECT = 4 * 1024 * 1024;

export function CallInput({ blobEnabled, transcriptionMode, aiMode }: { blobEnabled: boolean; transcriptionMode: string; aiMode: string }) {
  const [tab, setTab] = useState<"notes" | "audio">("notes");
  const [notes, setNotes] = useState("");
  const [state, action, pending] = useActionState(processNotes, {});
  const [audioState, setAudioState] = useState<{ busy: boolean; error?: string; step?: string }>({ busy: false });
  const router = useRouter();

  async function onAudio(file: File | undefined) {
    if (!file) return;
    if (!/\.(mp3|m4a)$/i.test(file.name)) return setAudioState({ busy: false, error: "Upload an MP3 or M4A file." });
    if (file.size > 25 * 1024 * 1024) return setAudioState({ busy: false, error: "Recordings must be under 25 MB." });
    setAudioState({ busy: true, step: "Uploading…" });
    try {
      let res: Response;
      if (blobEnabled && file.size > MAX_DIRECT) {
        const blob = await upload(`calls/${file.name}`, file, { access: "public", handleUploadUrl: "/api/calls/blob" });
        setAudioState({ busy: true, step: "Transcribing and extracting…" });
        res = await fetch("/api/calls/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blobUrl: blob.url, filename: file.name, mimeType: file.type || "audio/mpeg" }) });
      } else {
        const fd = new FormData();
        fd.append("file", file);
        setAudioState({ busy: true, step: "Transcribing and extracting…" });
        res = await fetch("/api/calls/upload", { method: "POST", body: fd });
      }
      const data = await res.json().catch(() => ({ error: res.status === 413 ? "File too large for direct upload. Configure Vercel Blob or trim the recording." : "Upload failed." }));
      if (!res.ok) return setAudioState({ busy: false, error: data.error });
      router.push(`/dashboard/calls/${data.id}`);
    } catch {
      setAudioState({ busy: false, error: "Upload failed. Please try again." });
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex border-b border-line">
        {(["notes", "audio"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cx("flex-1 px-4 py-3 text-sm font-medium", tab === t ? "border-b-2 border-accent text-ink" : "text-muted hover:text-ink")}>
            {t === "notes" ? "Paste notes or transcript" : "Upload recording (MP3 / M4A)"}
          </button>
        ))}
      </div>
      {tab === "notes" ? (
        <form action={action} className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            {SAMPLE_CALLS.map((c) => <Button key={c.id} type="button" size="sm" variant="ghost" onClick={() => setNotes(c.text)}>{c.label}</Button>)}
          </div>
          <Textarea name="notes" rows={14} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste your call notes or a transcript. Include price, rent, down payment, credit, goals and concerns." aria-label="Call notes" />
          {state.error && <Notice tone="bad">{state.error}</Notice>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">Extraction: {aiMode}</span>
            <Button variant="accent" disabled={pending || notes.trim().length < 40}>{pending ? "Extracting deal details…" : "Extract deal details"}</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3 p-5">
          <label className={cx("flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-paper/60 px-4 py-12 text-center hover:border-accent", audioState.busy && "pointer-events-none opacity-60")}>
            <input type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" className="sr-only" onChange={(e) => onAudio(e.target.files?.[0])} data-testid="audio-input" />
            <span className="font-medium">{audioState.busy ? audioState.step : "Choose a call recording"}</span>
            <span className="mt-1 text-xs text-muted">MP3 or M4A, up to 25 MB. The audio file is deleted as soon as it's transcribed.</span>
          </label>
          {audioState.error && <Notice tone="bad">{audioState.error}</Notice>}
          <p className="text-xs text-muted">Transcription: {transcriptionMode} · Extraction: {aiMode}. Make sure you have the investor's consent to record where your state requires it.</p>
        </div>
      )}
    </Card>
  );
}
