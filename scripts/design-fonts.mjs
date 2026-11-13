#!/usr/bin/env node
/**
 * One-time download of the five OFL font families used by the themes (`npm run design:fonts`).
 * WOFF2 (latin subset) for the web via next/font/local; TTF for react-pdf. Files are committed so
 * builds and CI never depend on Google Fonts being reachable.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const OUT = "src/design/fonts";
const FAMILIES = [
  { css: "Instrument+Serif:ital@0;1", file: "instrument-serif", faces: [["400", "normal"], ["400", "italic"]] },
  { css: "Hanken+Grotesk:wght@400;500;600", file: "hanken-grotesk", faces: [["400", "normal"], ["500", "normal"], ["600", "normal"]] },
  { css: "IBM+Plex+Sans:wght@400;500;600", file: "ibm-plex-sans", faces: [["400", "normal"], ["500", "normal"], ["600", "normal"]] },
  { css: "IBM+Plex+Mono:wght@400;500", file: "ibm-plex-mono", faces: [["400", "normal"], ["500", "normal"]] },
  { css: "Inter+Tight:wght@400;500;600;700", file: "inter-tight", faces: [["400", "normal"], ["500", "normal"], ["600", "normal"], ["700", "normal"]] },
];
const MODERN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

mkdirSync(OUT, { recursive: true });
async function css(family, ua) {
  const r = await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`, { headers: ua ? { "User-Agent": ua } : {} });
  if (!r.ok) throw new Error(`CSS ${family}: ${r.status}`);
  return r.text();
}
function faces(text) {
  return [...text.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*{([^}]+)}/g)].map((m) => ({
    subset: m[1] ?? null,
    style: /font-style:\s*(\w+)/.exec(m[2])[1],
    weight: /font-weight:\s*(\d+)/.exec(m[2])[1],
    url: /url\(([^)]+)\)/.exec(m[2])[1],
  }));
}
async function save(url, path) {
  if (existsSync(path)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  console.log("saved", path);
}
for (const f of FAMILIES) {
  const web = faces(await css(f.css, MODERN)).filter((x) => x.subset === "latin");
  const ttf = faces(await css(f.css, ""));
  for (const [w, st] of f.faces) {
    const name = `${f.file}-${w}${st === "italic" ? "-italic" : ""}`;
    const a = web.find((x) => x.weight === w && x.style === st);
    const b = ttf.find((x) => x.weight === w && x.style === st);
    if (!a || !b) throw new Error(`missing ${name}`);
    await save(a.url, `${OUT}/${name}.woff2`);
    await save(b.url, `${OUT}/${name}.ttf`);
  }
}
writeFileSync(`${OUT}/LICENSE.md`, "All fonts in this folder are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org): Instrument Serif, Hanken Grotesk, IBM Plex Sans, IBM Plex Mono, Inter Tight. Downloaded from Google Fonts by scripts/design-fonts.mjs.\n");
