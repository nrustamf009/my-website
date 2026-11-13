"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAppearance } from "@/lib/actions/settings";
import { THEMES, checkAccent, themeIds, type ThemeId } from "@design";
import { Button, Notice, cx } from "@/components/ui";
import { ImageInput } from "@/components/settings/forms";
import { ThemeSwatch } from "@design/components/ThemeSwatch";

export function AppearanceForm({ slug, theme: initialTheme, accent: initialAccent, logoOnDarkUrl, listingToken, saved }: { slug: string; theme: ThemeId; accent: string; logoOnDarkUrl: string | null; listingToken: string | null; saved?: boolean }) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const [accent, setAccent] = useState(initialAccent);
  const [surface, setSurface] = useState<"check" | "listing">("check");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(saved ? { tone: "good", text: "Saved. Every page, PDF and email now uses this look." } : null);
  const [pending, start] = useTransition();
  const valid = /^#[0-9a-f]{6}$/i.test(accent);
  const check = valid ? checkAccent(theme, accent) : null;
  const def = THEMES[theme];
  const previewUrl = useMemo(() => {
    const q = new URLSearchParams({ previewTheme: theme, ...(valid ? { previewAccent: accent } : {}) });
    return surface === "listing" && listingToken ? `/b/${slug}/l/${listingToken}?${q}` : `/b/${slug}/check?price=385000&rent=2950&state=OH&${q}`;
  }, [theme, accent, valid, surface, slug, listingToken]);

  const save = (fd?: FormData) =>
    start(async () => {
      const r = await saveAppearance({ theme, accentColor: accent, logoOnDarkUrl: String(fd?.get("logoOnDarkUrl") ?? logoOnDarkUrl ?? "") });
      // A new theme can change the whole dashboard shell (and remount this form), so confirm via the URL.
      if (r.ok) router.replace("/dashboard/settings/appearance?saved=1");
      else setMsg({ tone: "bad", text: r.error ?? "Could not save" });
    });

  return (
    <form action={save} className="space-y-6" data-testid="appearance">
      <section aria-labelledby="ap-theme">
        <h2 id="ap-theme" className="type-section text-ink">Theme</h2>
        <p className="mt-1 text-sm text-muted">Applies to your public pages, embed, PDFs, emails and this dashboard.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
          {themeIds.map((id) => {
            const t = THEMES[id];
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme === id}
                onClick={() => {
                  setTheme(id);
                  if (!checkAccent(id, accent).ok) setAccent(t.defaultAccent);
                }}
                className={cx("overflow-hidden border text-left transition", theme === id ? "border-accent ring-2 ring-accent" : "border-rule hover:border-ink")}
                data-testid={`theme-${id}`}
              >
                <ThemeSwatch id={id} />
                <div className="bg-surface p-3">
                  <div className="font-semibold text-ink">{t.name}</div>
                  <div className="text-xs text-muted">{t.tagline}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="ap-accent">
        <h2 id="ap-accent" className="type-section text-ink">Accent color</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {def.presets.map((p) => (
            <button key={p} type="button" onClick={() => setAccent(p)} aria-label={`Preset ${p}`} aria-pressed={accent.toUpperCase() === p} className={cx("h-10 w-10 border", accent.toUpperCase() === p ? "border-ink ring-2 ring-ink" : "border-rule")} style={{ background: p }} />
          ))}
          <label className="ml-2 flex items-center gap-2 text-sm text-ink-2">
            Custom
            <input type="color" value={valid ? accent : def.defaultAccent} onChange={(e) => setAccent(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer border border-rule bg-surface" aria-label="Pick a custom accent" />
            <input value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-28 border border-rule bg-surface px-2 font-mono text-sm text-ink" aria-label="Accent hex" />
          </label>
        </div>
        <p className={cx("mt-2 text-sm", check && !check.ok ? "text-negative" : "text-muted")} role="status" data-testid="contrast">
          {!valid
            ? "Use a 6-digit hex color."
            : check!.ok
              ? `Text on accent ${check!.ratios.onAccent}:1 · accent text on background ${check!.ratios.accentTextOnBg}:1 (AA needs 4.5:1)${check!.accentText !== check!.accent ? `. Text uses ${check!.accentText} so it stays readable.` : "."}`
              : check!.reason}
        </p>
      </section>

      <section aria-labelledby="ap-logo">
        <h2 id="ap-logo" className="type-section text-ink">Logo on dark backgrounds (optional)</h2>
        <p className="mb-2 mt-1 text-sm text-muted">Used on dark panels. Without it we place your logo on a light chip.</p>
        <ImageInput name="logoOnDarkUrl" initial={logoOnDarkUrl} label="Upload logo" />
      </section>

      <section aria-labelledby="ap-preview">
        <div className="flex items-center justify-between gap-3">
          <h2 id="ap-preview" className="type-section text-ink">Preview</h2>
          <div className="flex border border-rule text-sm" role="tablist">
            {(["check", "listing"] as const).filter((s) => s === "check" || listingToken).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={surface === s} onClick={() => setSurface(s)} className={cx("px-3 py-1.5", surface === s ? "bg-ink text-page" : "text-ink-2")}>{s === "check" ? "Instant Check" : "Listing page"}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex justify-center border border-rule bg-surface-alt p-4">
          <iframe key={previewUrl} src={previewUrl} title="Theme preview" className="h-160 w-full max-w-97.5 border border-rule bg-page" data-testid="preview-frame" />
        </div>
        <p className="mt-2 text-xs text-muted">Only you and your agency can preview unsaved changes; investors always see the saved look.</p>
      </section>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Button variant="accent" size="lg" disabled={pending || !check?.ok}>{pending ? "Saving…" : "Save appearance"}</Button>
    </form>
  );
}
