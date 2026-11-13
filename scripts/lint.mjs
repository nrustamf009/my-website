#!/usr/bin/env node
/**
 * Project guard rails (no extra dependencies). Fails CI when:
 *  1. a banned word appears in UI/PDF/email/AI-draft code or strings,
 *  2. money math happens outside lib/dscr (formatting and boundary parsing are allowed),
 *  3. tenant models are queried through the raw Prisma client instead of forBroker(),
 *  4. a "use server" module exports something other than async functions and types,
 *  5. design values (hex colors, font names, px constants) appear outside src/design/,
 *  6. code outside the six variant components branches on the theme id.
 * Files still being migrated to the design system are listed in scripts/design-legacy.json;
 * the list may only shrink (a listed file that is already clean fails the lint).
 * Run: npm run lint   (CLAUDE.md non-negotiables; see docs/ARCHITECTURE.md)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = ["app", "components", "lib"];
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(relative(ROOT, p));
  }
};
SRC.forEach((d) => walk(join(ROOT, d)));

const problems = [];
const report = (file, line, rule, text) => problems.push(`${file}:${line}  [${rule}]  ${text.trim().slice(0, 140)}`);
const codeLines = (src) =>
  src.split("\n").map((l, i) => ({ n: i + 1, l, comment: /^\s*(\/\/|\*|\/\*)/.test(l) }));

// 1. Banned words (the required disclaimer negation "not a commitment to lend" is allowed).
const BANNED = /\b(pre-?approved|pre-?approval|approved|pre-?qualified|pre-?qualify|prequalif\w*|qualifies|guaranteed|guarantee|commitment)\b/i;
const BANNED_EXEMPT = ["lib/compliance/", "lib/providers/ai/prompts.ts", "lib/providers/ai/guard.ts"];
const NEGATION = /not (?:a |an offer or (?:a )?)?commitment to lend/gi;

// 2. Money math outside the engine.
const MATH = /(?:\b\w*(?:Cents|Milli|Ratio)\b\s*[-+*/]\s*[\w(]|[-+*/]\s*[\w.!?]*(?:Cents|Milli|Ratio)\b|\*\s*12\b|\b10_000\s*-|\/\s*100\b|\*\s*100\b)/;
const MATH_EXEMPT = ["lib/dscr/", "lib/format.ts", "lib/charts/", "lib/providers/", "lib/moneylist/csv.ts", "lib/actions/settings.ts"];
const MATH_OK_LINE = /\b(points|usd|usdMagnitude|pct|rate|dscr)\(\s*-?\w/; // sign flips inside formatters

// 3. Raw prisma on tenant models.
const TENANT = /\bprisma\.(lead|consent|event|scenario|scenarioOption|scenarioView|realtor|snapshot|loanImport|closedLoan|loanStatusChange|savedNote|webhookDelivery|disclaimerVersion)\b/;
const TENANT_EXEMPT = ["lib/db/"];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = codeLines(src);
  if (!BANNED_EXEMPT.some((x) => f.startsWith(x)))
    for (const { n, l, comment } of lines) if (!comment && BANNED.test(l.replace(NEGATION, "")) && !/BANNED_WORDS/.test(l)) report(f, n, "banned-word", l);
  if (!MATH_EXEMPT.some((x) => f.startsWith(x)))
    for (const { n, l, comment } of lines) if (!comment && MATH.test(l) && !MATH_OK_LINE.test(l.match(MATH)?.input.slice(Math.max(0, l.search(MATH) - 20), l.search(MATH) + 5) ?? "")) report(f, n, "money-math", l);
  if (!TENANT_EXEMPT.some((x) => f.startsWith(x)))
    for (const { n, l, comment } of lines) if (!comment && TENANT.test(l)) report(f, n, "raw-prisma", l);
  if (/^["']use server["'];?/m.test(src.split("\n").slice(0, 3).join("\n")))
    for (const { n, l } of lines) if (/^export\s+(const|let|var|class|default\s+(?!async))/.test(l)) report(f, n, "use-server-export", l);
}

// 5–6. Design system (DESIGN.md §2.1, §6).
const HEX = /(?<![\w&#])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w])/;
const FONT = /\b(Fraunces|Instrument Serif|Hanken Grotesk|IBM Plex|Inter Tight|Georgia|Helvetica)\b|font-family|fontFamily/;
const PX = /\b\d+(?:\.\d+)?px\b|-\[\d+(?:\.\d+)?px\]/;
const BRANCH = /data-theme|useTheme\(|\.(?:id|theme)\s*[!=]==?\s*["'](?:maison|terminal|atelier)["']/;
const DESIGN_DIRS = ["app", "components", "lib"];
const legacy = new Set(JSON.parse(readFileSync(join(ROOT, "scripts/design-legacy.json"), "utf8")).files);
const designFiles = files.filter((f) => DESIGN_DIRS.some((d) => f.startsWith(d + "/")) && !f.startsWith("lib/dscr/"));
const cssFiles = [];
DESIGN_DIRS.forEach((d) => {
  const w = (dir) => readdirSync(dir).forEach((f) => { const p = join(dir, f); if (statSync(p).isDirectory()) w(p); else if (f.endsWith(".css")) cssFiles.push(relative(ROOT, p)); });
  w(join(ROOT, d));
});
const designHits = new Map();
for (const f of [...designFiles, ...cssFiles]) {
  const hits = [];
  for (const { n, l, comment } of codeLines(readFileSync(f, "utf8"))) {
    if (comment) continue;
    if (HEX.test(l)) hits.push([n, "design-hex", l]);
    if (FONT.test(l)) hits.push([n, "design-font", l]);
    if (PX.test(l)) hits.push([n, "design-px", l]);
    if (BRANCH.test(l)) hits.push([n, "theme-branch", l]);
  }
  if (hits.length) designHits.set(f, hits);
}
for (const [f, hits] of designHits) if (!legacy.has(f)) for (const [n, rule, l] of hits) report(f, n, rule, l);
for (const f of legacy) if (!designHits.has(f)) report(f, 0, "design-legacy", "is clean now: remove it from scripts/design-legacy.json");
const legacyLeft = [...legacy].filter((f) => designHits.has(f)).length;

if (problems.length) {
  console.error(`✗ ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n` + problems.join("\n"));
  process.exit(1);
}
console.log(`✓ guards passed (${files.length} files): banned words, money math in lib/dscr only, tenant scoping, server actions, design tokens (${legacyLeft} legacy file${legacyLeft === 1 ? "" : "s"} left to migrate)`);
